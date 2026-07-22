import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    DEFAULT_SCANNER_SERIAL_BAUD_RATE,
    DEFAULT_SCANNER_SERIAL_IDLE_TIMEOUT_MS,
    createScannerSerialFrameDecoder,
    getGrantedSerialPorts,
    isWebSerialSupported,
    sanitizeScannerPayload,
} from './web-serial-scanner'

describe('Web Serial scanner helpers', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('uses the scanner serial defaults', () => {
        expect(DEFAULT_SCANNER_SERIAL_BAUD_RATE).toBe(9600)
        expect(DEFAULT_SCANNER_SERIAL_IDLE_TIMEOUT_MS).toBe(120)
    })

    it('detects Web Serial support only when both serial methods exist', () => {
        expect(isWebSerialSupported(undefined)).toBe(false)
        expect(isWebSerialSupported({})).toBe(false)
        expect(
            isWebSerialSupported({
                serial: {
                    requestPort: vi.fn(),
                    getPorts: vi.fn(),
                },
            }),
        ).toBe(true)
    })

    it('returns previously granted ports from the serial API', async () => {
        const firstPort = { readable: null }
        const secondPort = { readable: null }
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([firstPort, secondPort]),
        }

        await expect(getGrantedSerialPorts(serialApi)).resolves.toEqual([firstPort, secondPort])
        expect(serialApi.getPorts).toHaveBeenCalledTimes(1)
    })

    it('normalizes BOM and control separators without interpreting payload content', () => {
        expect(sanitizeScannerPayload('\uFEFFCDC-XN-22072026-0001\u001dABC\r\n\t')).toBe(
            'CDC-XN-22072026-0001|ABC',
        )
    })

    it('decodes Vietnamese UTF-8 split across byte chunks', () => {
        const onPayload = vi.fn()
        const decoder = createScannerSerialFrameDecoder({ onPayload })
        const bytes = new TextEncoder().encode('Nguyễn Thiện Chí\n')
        const splitIndex = bytes.findIndex((value) => value > 127)

        decoder.push(bytes.slice(0, splitIndex + 1))
        decoder.push(bytes.slice(splitIndex + 1))

        expect(onPayload).toHaveBeenCalledOnce()
        expect(onPayload).toHaveBeenCalledWith('Nguyễn Thiện Chí')
    })

    it('frames payloads with CR, LF, and CRLF delimiters', () => {
        const onPayload = vi.fn()
        const decoder = createScannerSerialFrameDecoder({ onPayload })

        decoder.push(new TextEncoder().encode('first\rsecond\nthird\r\n'))

        expect(onPayload.mock.calls).toEqual([['first'], ['second'], ['third']])
    })

    it('flushes an incomplete frame after 120 ms of inactivity', async () => {
        const onPayload = vi.fn()
        const decoder = createScannerSerialFrameDecoder({ onPayload })

        decoder.push(new TextEncoder().encode('CDC-XN-22072026-0001'))
        await vi.advanceTimersByTimeAsync(DEFAULT_SCANNER_SERIAL_IDLE_TIMEOUT_MS - 1)
        expect(onPayload).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1)
        expect(onPayload).toHaveBeenCalledWith('CDC-XN-22072026-0001')
    })

    it('drops an incomplete frame when reset', async () => {
        const onPayload = vi.fn()
        const decoder = createScannerSerialFrameDecoder({ onPayload })

        decoder.push(new TextEncoder().encode('incomplete'))
        decoder.reset()
        await vi.advanceTimersByTimeAsync(DEFAULT_SCANNER_SERIAL_IDLE_TIMEOUT_MS)

        expect(onPayload).not.toHaveBeenCalled()

        decoder.push(new TextEncoder().encode('complete\n'))
        expect(onPayload).toHaveBeenCalledOnce()
        expect(onPayload).toHaveBeenCalledWith('complete')
    })
})
