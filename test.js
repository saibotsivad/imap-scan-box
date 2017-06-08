const test = require('tape')
const EventEmitter = require('events')
const scanBox = require('./index')

test('there is an error opening the box stop early', t => {
	const error = { message: 'specific error' }
	const imapMock = {
		openBox(boxName, openAsReadOnly, cb) {
			t.equal('INBOX', boxName, 'box name is the one provided')
			t.ok(openAsReadOnly, 'scanning the box does not modify contents')
			cb(error)
		}
	}
	const scanner = scanBox(imapMock, 'INBOX')
	scanner.on('error', output => {
		t.ok(output.error === error, 'the error is the same by reference')
		t.equal(output.action, 'open', 'the error happens during opening')
		t.end()
	})
})

test('box opens but fetch fails', t => {
	t.plan(6)
	const error = { message: 'specific error' }
	const box = { name: 'ALTBOX' }
	const fetchEmitter = new EventEmitter()
	const imapMock = {
		openBox(boxName, openAsReadOnly, cb) {
			cb(false, box)
		},
		seq: {
			fetch(range, fetch) {
				t.equal(range, '1:*', 'the default range')
				t.ok(fetch.struct, 'default struct is true')
				t.equal(fetch.bodies, 'HEADER.FIELDS (FROM TO SUBJECT DATE)', 'the default body fetch')
				return fetchEmitter
			}
		}
	}
	const scanner = scanBox(imapMock, 'INBOX')
	scanner.on('opened', emittedBox => {
		t.ok(emittedBox === box, 'emitted box is same by reference')
	})
	scanner.on('error', output => {
		t.ok(output.error === error, 'the error is the same by reference')
		t.equal(output.action, 'fetch', 'the error happens during fetching')
		t.end()
	})
	setTimeout(() => {
		fetchEmitter.emit('error', error)
	})
})

test('box opens and fetches but fails to close', t => {
	t.plan(4)
	const error = { message: 'specific error' }
	const box = { name: 'ALTBOX' }
	const fetchEmitter = new EventEmitter()
	const imapMock = {
		openBox(boxName, openAsReadOnly, cb) {
			cb(false, box)
		},
		closeBox(autoExpunge, cb) {
			t.notOk(autoExpunge, 'should never modify the box on a scan')
			cb(error)
		},
		seq: {
			fetch(range, fetch) {
				return fetchEmitter
			}
		}
	}
	const scanner = scanBox(imapMock, 'INBOX')
	scanner.on('opened', emittedBox => {
		t.ok(emittedBox === box, 'emitted box is same by reference')
	})
	scanner.on('error', output => {
		t.ok(output.error === error, 'the error is the same by reference')
		t.equal(output.action, 'close', 'the error happens during fetching')
		t.end()
	})
	setTimeout(() => {
		fetchEmitter.emit('end')
	})
})

test('box opens and fetches but fails to close', t => {
	t.plan(3)
	const error = { message: 'specific error' }
	const box = { name: 'ALTBOX' }
	const message = { id: 'msg001' }
	const fetchEmitter = new EventEmitter()
	const imapMock = {
		openBox(boxName, openAsReadOnly, cb) {
			cb(false, box)
		},
		closeBox(autoExpunge, cb) {
			cb()
		},
		seq: {
			fetch(range, fetch) {
				return fetchEmitter
			}
		}
	}
	const scanner = scanBox(imapMock, 'INBOX')
	scanner.on('message', ({ stream, sequenceNumber }) => {
		t.ok(stream === message, 'although in the test not a stream, check by reference')
		t.equal(sequenceNumber, 123, 'an emitted sequence number')
	})
	scanner.on('closed', emittedBox => {
		t.ok(emittedBox === box, 'emitted box is same by reference')
	})
	scanner.on('end', () => {
		t.end()
	})
	setTimeout(() => {
		fetchEmitter.emit('message', ...[ message, 123 ])
		setTimeout(() => {
			fetchEmitter.emit('end')
		})
	})
})
