import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    openDetachedHtmlDocument,
    openPendingDetachedHtmlDocument,
} from './detached-html-document'

class FakeBroadcastChannel {
    static instances: FakeBroadcastChannel[] = []

    readonly close = vi.fn()
    readonly postMessage = vi.fn()
    private readonly messageListeners: Array<(event: MessageEvent) => void> = []

    constructor(readonly name: string) {
        FakeBroadcastChannel.instances.push(this)
    }

    addEventListener(type: string, listener: EventListener) {
        if (type === 'message') {
            this.messageListeners.push(listener as (event: MessageEvent) => void)
        }
    }

    emitMessage(data: unknown) {
        const event = { data } as MessageEvent
        this.messageListeners.forEach((listener) => listener(event))
    }
}

function readBlobAsText(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error)
        reader.onload = () => resolve(String(reader.result))
        reader.readAsText(blob)
    })
}

describe('openDetachedHtmlDocument', () => {
    beforeEach(() => {
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('renders auto-print HTML inside a script-disabled detached frame', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
        const createObjectUrlSpy = vi
            .spyOn(URL, 'createObjectURL')
            .mockReturnValue('blob:detached-print')
        const sourceHtml = '<html><body></script><script>window.pwned = true</script></body></html>'

        openDetachedHtmlDocument(sourceHtml, {
            autoPrint: true,
        })

        expect(openSpy).toHaveBeenCalledWith(
            'blob:detached-print',
            '_blank',
            'noopener,noreferrer',
        )

        const blob = createObjectUrlSpy.mock.calls[0]?.[0]
        expect(blob).toBeInstanceOf(Blob)

        const shellHtml = await readBlobAsText(blob)
        expect(shellHtml).toContain('sandbox="allow-same-origin allow-modals"')
        expect(shellHtml).toContain('frame.srcdoc = message.html')
        expect(shellHtml).toContain('frame.contentWindow.print()')
        expect(shellHtml).not.toContain(sourceHtml)

        const channel = FakeBroadcastChannel.instances[0]
        expect(channel.postMessage).not.toHaveBeenCalled()

        channel.emitMessage({ type: 'ready' })

        expect(channel.postMessage).toHaveBeenCalledWith({
            type: 'render',
            html: sourceHtml,
            autoPrint: true,
        })
        expect(channel.close).not.toHaveBeenCalled()

        channel.emitMessage({ type: 'completed' })
        expect(channel.close).toHaveBeenCalledTimes(1)
    })

    it('opens a pending detached shell before rendering async HTML', () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending-print')

        const printDocument = openPendingDetachedHtmlDocument()
        const channel = FakeBroadcastChannel.instances[0]

        expect(openSpy).toHaveBeenCalledTimes(1)
        expect(channel.postMessage).not.toHaveBeenCalled()

        channel.emitMessage({ type: 'ready' })
        printDocument.render('<html><body>CoA</body></html>', { autoPrint: true })

        expect(channel.postMessage).toHaveBeenCalledWith({
            type: 'render',
            html: '<html><body>CoA</body></html>',
            autoPrint: true,
        })
    })

    it('keeps a ready shell alive while an async document takes over 60 seconds', () => {
        vi.useFakeTimers()
        vi.spyOn(window, 'open').mockReturnValue(null)
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:slow-print')

        const printDocument = openPendingDetachedHtmlDocument()
        const channel = FakeBroadcastChannel.instances[0]

        channel.emitMessage({ type: 'ready' })
        vi.advanceTimersByTime(60_000)
        printDocument.render('<html><body>Slow CoA</body></html>', { autoPrint: true })

        expect(channel.postMessage).toHaveBeenCalledWith({
            type: 'render',
            html: '<html><body>Slow CoA</body></html>',
            autoPrint: true,
        })
    })

    it('reports a blocked detached window when the shell never becomes ready', () => {
        vi.useFakeTimers()
        const onBlocked = vi.fn()
        vi.spyOn(window, 'open').mockReturnValue(null)
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blocked-print')
        const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL')

        openPendingDetachedHtmlDocument({ onBlocked })
        vi.advanceTimersByTime(5_000)

        expect(onBlocked).toHaveBeenCalledTimes(1)
        expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:blocked-print')
        expect(FakeBroadcastChannel.instances[0].close).toHaveBeenCalledTimes(1)
    })
})
