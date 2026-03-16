import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const html5QrcodeMocks = vi.hoisted(() => {
    const constructorSpy = vi.fn()
    const start = vi.fn()
    const stop = vi.fn().mockResolvedValue(undefined)
    const clear = vi.fn()
    const getRunningTrackCapabilities = vi.fn().mockReturnValue({})
    const getRunningTrackSettings = vi.fn().mockReturnValue({})
    const applyVideoConstraints = vi.fn().mockResolvedValue(undefined)

    class Html5Qrcode {
        constructor(...args: unknown[]) {
            constructorSpy(...args)
        }

        start = start
        stop = stop
        clear = clear
        getRunningTrackCapabilities = getRunningTrackCapabilities
        getRunningTrackSettings = getRunningTrackSettings
        applyVideoConstraints = applyVideoConstraints
    }

    return {
        constructorSpy,
        start,
        stop,
        clear,
        getRunningTrackCapabilities,
        getRunningTrackSettings,
        applyVideoConstraints,
        Html5Qrcode,
    }
})

vi.mock('html5-qrcode', () => ({
    Html5Qrcode: html5QrcodeMocks.Html5Qrcode,
    Html5QrcodeSupportedFormats: {
        QR_CODE: 0,
    },
}))

import { QRScanner } from '../qr-scanner'

describe('QRScanner optimized start profile', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        html5QrcodeMocks.start.mockReset()
        html5QrcodeMocks.stop.mockReset()
        html5QrcodeMocks.clear.mockReset()
        html5QrcodeMocks.getRunningTrackCapabilities.mockReset()
        html5QrcodeMocks.getRunningTrackSettings.mockReset()
        html5QrcodeMocks.applyVideoConstraints.mockReset()

        html5QrcodeMocks.start.mockResolvedValue(null)
        html5QrcodeMocks.stop.mockResolvedValue(undefined)
        html5QrcodeMocks.getRunningTrackCapabilities.mockReturnValue({})
        html5QrcodeMocks.getRunningTrackSettings.mockReturnValue({})
        html5QrcodeMocks.applyVideoConstraints.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
    })

    it('constructs Html5Qrcode with QR-only and BarcodeDetector-enabled config', async () => {
        render(<QRScanner onScan={vi.fn()} />)

        await act(async () => {
            vi.advanceTimersByTime(200)
            await Promise.resolve()
        })

        expect(html5QrcodeMocks.start).toHaveBeenCalledTimes(1)

        expect(html5QrcodeMocks.constructorSpy).toHaveBeenCalledWith(
            'qr-reader',
            expect.objectContaining({
                formatsToSupport: [0],
                useBarCodeDetectorIfSupported: true,
            }),
        )
    })

    it('starts scanning with tuned CCCD/VNeID profile including HD constraints', async () => {
        render(<QRScanner onScan={vi.fn()} />)

        await act(async () => {
            vi.advanceTimersByTime(200)
            await Promise.resolve()
        })

        expect(html5QrcodeMocks.start).toHaveBeenCalledTimes(1)

        const [, scannerConfig] = html5QrcodeMocks.start.mock.calls[0]

        expect(scannerConfig).toMatchObject({
            fps: 8,
            disableFlip: true,
        })
        expect(typeof scannerConfig.qrbox).toBe('function')
        expect(scannerConfig.videoConstraints).toEqual(
            expect.objectContaining({
                facingMode: expect.objectContaining({ ideal: 'environment' }),
                width: expect.objectContaining({ ideal: 1920 }),
                height: expect.objectContaining({ ideal: 1080 }),
            }),
        )
    })

    it('retries with compatibility profile when preferred constraints are unsupported', async () => {
        html5QrcodeMocks.start
            .mockRejectedValueOnce(new Error('OverconstrainedError: unsupported constraint'))
            .mockResolvedValueOnce(null)

        const onError = vi.fn()
        render(<QRScanner onScan={vi.fn()} onError={onError} />)

        await act(async () => {
            vi.advanceTimersByTime(200)
            await Promise.resolve()
        })

        expect(html5QrcodeMocks.start).toHaveBeenCalledTimes(2)

        const [, firstConfig] = html5QrcodeMocks.start.mock.calls[0]
        const [, secondConfig] = html5QrcodeMocks.start.mock.calls[1]

        expect(firstConfig.videoConstraints).toBeDefined()
        expect(secondConfig.videoConstraints).toBeUndefined()
        expect(onError).not.toHaveBeenCalled()
    })
})
