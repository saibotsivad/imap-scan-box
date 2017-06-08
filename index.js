const EventEmitter = require('events')

const openAsReadOnly = true
const autoExpunge = false
const defaultRange = '1:*'
const defaultFetch = {
	bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
	struct: true
}

module.exports = function imapScanBox(imap, boxName, range = defaultRange, fetch = defaultFetch) {
	const emitter = new EventEmitter()

	setTimeout(() => {
		imap.openBox(boxName, openAsReadOnly, (error, box) => {
			if (error) {
				emitter.emit('error', { action: 'open', error })
			} else {
				emitter.emit('opened', box)

				const imapFetch = imap.seq.fetch(range, fetch)

				imapFetch.on('message', (stream, sequenceNumber) => {
					emitter.emit('message', { sequenceNumber, stream })
				})

				imapFetch.once('error', error => emitter.emit('error', { action: 'fetch', error }))

				imapFetch.once('end', () => {
					imap.closeBox(autoExpunge, error => {
						if (error) {
							emitter.emit('error', { action: 'close', error })
						} else {
							emitter.emit('closed', box)
						}
						emitter.emit('end')
					})
				})
			}
		})
	})

	return emitter
}
