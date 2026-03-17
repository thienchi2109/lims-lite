export const DEFAULT_CCCD_SERIAL_IDLE_TIMEOUT_MS = 120
export const DEFAULT_CCCD_SERIAL_BAUD_RATE = 9600

type WebSerialTarget = {
    serial?: {
        requestPort?: unknown
        getPorts?: unknown
    }
}

type GrantedPortApi<TPort> = {
    getPorts: () => Promise<TPort[]>
}

type CccdSerialFrameDecoderOptions = {
    idleTimeoutMs?: number
    onPayload: (payload: string) => void
}

type CccdSerialFrameDecoder = {
    push: (chunk: Uint8Array) => void
    flush: () => void
    reset: () => void
}

export function isWebSerialSupported(target: WebSerialTarget | undefined): boolean {
    return Boolean(
        target?.serial &&
        typeof target.serial.requestPort === 'function' &&
        typeof target.serial.getPorts === 'function',
    )
}

export async function getGrantedSerialPorts<TPort>(serialApi: GrantedPortApi<TPort>): Promise<TPort[]> {
    return serialApi.getPorts()
}

export function sanitizeCccdSerialPayload(value: string): string {
    return value
        .replace(/\uFEFF/g, '')
        .replace(/[\u001c\u001d\u001e\u001f]/g, '|')
        .replace(/[\u0000-\u001b\u007f]/g, '')
        .trim()
}

export function createCccdSerialFrameDecoder({
    idleTimeoutMs = DEFAULT_CCCD_SERIAL_IDLE_TIMEOUT_MS,
    onPayload,
}: CccdSerialFrameDecoderOptions): CccdSerialFrameDecoder {
    let decoder = new TextDecoder('utf-8')
    let buffer = ''
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const clearIdleTimer = () => {
        if (idleTimer === null) return
        clearTimeout(idleTimer)
        idleTimer = null
    }

    const emitPayload = (payload: string) => {
        const sanitizedPayload = sanitizeCccdSerialPayload(payload)
        if (!sanitizedPayload) return
        onPayload(sanitizedPayload)
    }

    const consumeCompletePayloads = () => {
        let separatorIndex = buffer.search(/[\r\n]/)

        while (separatorIndex >= 0) {
            const payload = buffer.slice(0, separatorIndex)
            const separatorLength = buffer[separatorIndex] === '\r' && buffer[separatorIndex + 1] === '\n' ? 2 : 1
            buffer = buffer.slice(separatorIndex + separatorLength).replace(/^[\r\n]+/, '')
            emitPayload(payload)
            clearIdleTimer()
            separatorIndex = buffer.search(/[\r\n]/)
        }
    }

    const scheduleIdleFlush = () => {
        clearIdleTimer()

        if (!buffer) return

        idleTimer = setTimeout(() => {
            idleTimer = null
            flush()
        }, idleTimeoutMs)
    }

    const flush = () => {
        buffer += decoder.decode()
        emitPayload(buffer)
        buffer = ''
        clearIdleTimer()
        decoder = new TextDecoder('utf-8')
    }

    return {
        push(chunk) {
            buffer += decoder.decode(chunk, { stream: true })
            consumeCompletePayloads()
            scheduleIdleFlush()
        },
        flush,
        reset() {
            buffer = ''
            clearIdleTimer()
            decoder = new TextDecoder('utf-8')
        },
    }
}
