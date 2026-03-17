import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    createCccdSerialFrameDecoder,
    getGrantedSerialPorts,
    isWebSerialSupported,
    sanitizeCccdSerialPayload,
} from './web-serial-cccd'

describe('Web Serial CCCD helpers', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('detects Web Serial support only when navigator.serial exists', () => {
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

    it('sanitizes BOM, control separators, and line breaks for CCCD payloads', () => {
        expect(
            sanitizeCccdSerialPayload('\uFEFF086094006827\u001d331757192\r\nNguyễn Văn A\t'),
        ).toBe('086094006827|331757192Nguyễn Văn A')
    })

    it('decodes split UTF-8 chunks and emits a payload when a newline arrives', () => {
        const onPayload = vi.fn()
        const decoder = createCccdSerialFrameDecoder({
            idleTimeoutMs: 120,
            onPayload,
        })

        const bytes = new TextEncoder().encode('086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|\n')
        const splitIndex = bytes.findIndex((value) => value > 127)

        decoder.push(bytes.slice(0, splitIndex + 1))
        decoder.push(bytes.slice(splitIndex + 1))

        expect(onPayload).toHaveBeenCalledTimes(1)
        expect(onPayload).toHaveBeenCalledWith(
            '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|',
        )
    })

    it('flushes the buffered payload after idle timeout when no newline is sent', async () => {
        const onPayload = vi.fn()
        const decoder = createCccdSerialFrameDecoder({
            idleTimeoutMs: 120,
            onPayload,
        })

        decoder.push(
            new TextEncoder().encode(
                '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|Cần Thơ|10052021',
            ),
        )

        expect(onPayload).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(120)

        expect(onPayload).toHaveBeenCalledTimes(1)
        expect(onPayload).toHaveBeenCalledWith(
            '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|Cần Thơ|10052021',
        )
    })
})
