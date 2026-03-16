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
        expect(scannerConfig.videoConstraints.width).not.toHaveProperty('min')
        expect(scannerConfig.videoConstraints.height).not.toHaveProperty('min')
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

    it('applies runtime camera enhancements when capabilities are supported', async () => {
        html5QrcodeMocks.getRunningTrackCapabilities.mockReturnValue({
            zoom: { min: 1, max: 3, step: 0.1 },
            torch: true,
            focusMode: ['continuous', 'manual'],
            focusDistance: { min: 0, max: 2.5, step: 0.1 },
        })
        html5QrcodeMocks.getRunningTrackSettings.mockReturnValue({
            zoom: 1,
            torch: false,
        })

        render(<QRScanner onScan={vi.fn()} />)

        await act(async () => {
            vi.advanceTimersByTime(200)
            await Promise.resolve()
        })

        expect(html5QrcodeMocks.applyVideoConstraints).toHaveBeenCalledWith(
            expect.objectContaining({
                zoom: 1.2,
                torch: true,
                focusMode: 'continuous',
                focusDistance: 2.5,
            }),
        )
    })

    it('skips runtime tuning safely when no advanced camera capability is available', async () => {
        html5QrcodeMocks.getRunningTrackCapabilities.mockReturnValue({})
        html5QrcodeMocks.getRunningTrackSettings.mockReturnValue({})

        render(<QRScanner onScan={vi.fn()} />)

        await act(async () => {
            vi.advanceTimersByTime(200)
            await Promise.resolve()
        })

        expect(html5QrcodeMocks.applyVideoConstraints).not.toHaveBeenCalled()
    })

    it('shows non-blocking Vietnamese guidance while scanning', async () => {
        const { getByText } = render(<QRScanner onScan={vi.fn()} />)

        await act(async () => {
            vi.advanceTimersByTime(200)
            await Promise.resolve()
        })

        expect(getByText(/Mẹo quét nhanh/i)).toBeDefined()
    })

    it('shows compatibility guidance when preferred constraints are downgraded', async () => {
        html5QrcodeMocks.start
            .mockRejectedValueOnce(new Error('OverconstrainedError: unsupported constraint'))
            .mockResolvedValueOnce(null)

        const { getByText } = render(<QRScanner onScan={vi.fn()} />)

        await act(async () => {
            vi.advanceTimersByTime(300)
            await Promise.resolve()
        })

        expect(getByText(/chế độ tương thích/i)).toBeDefined()
    })

    it('keeps compatibility guidance after no-code errors while in compatibility mode', async () => {
        html5QrcodeMocks.start
            .mockRejectedValueOnce(new Error('OverconstrainedError: unsupported constraint'))
            .mockImplementationOnce(
                async (
                    _camera: unknown,
                    _config: unknown,
                    _onSuccess: (decodedText: string, result?: unknown) => void,
                    onError: (errorMessage: string) => void,
                ) => {
                    setTimeout(() => onError('NotFoundException: no code found'), 1200)
                    return null
                },
            )

        const { getByText, queryByText } = render(<QRScanner onScan={vi.fn()} />)

        await act(async () => {
            vi.advanceTimersByTime(300)
            await Promise.resolve()
        })

        expect(getByText(/chế độ tương thích/i)).toBeDefined()

        await act(async () => {
            vi.advanceTimersByTime(1600)
            await Promise.resolve()
        })

        expect(getByText(/chế độ tương thích/i)).toBeDefined()
        expect(queryByText(/Mẹo quét nhanh/i)).toBeNull()
    })

    it('captures success telemetry with decoder source and preserves auto-close flow', async () => {
        const onScan = vi.fn()
        const onTelemetry = vi.fn()

        html5QrcodeMocks.start.mockImplementationOnce(
            async (
                _camera: unknown,
                _config: unknown,
                onSuccess: (decodedText: string, result?: unknown) => void,
            ) => {
                setTimeout(() => {
                    onSuccess('CCCD|DUMMY|PAYLOAD', {
                        result: {
                            debugData: { decoderName: 'zxing-js' },
                        },
                    })
                }, 1500)
                return null
            },
        )

        render(<QRScanner onScan={onScan} onTelemetry={onTelemetry} />)

        await act(async () => {
            vi.advanceTimersByTime(300)
            await Promise.resolve()
        })

        await act(async () => {
            vi.advanceTimersByTime(1700)
            await Promise.resolve()
        })

        expect(onScan).toHaveBeenCalledWith('CCCD|DUMMY|PAYLOAD')
        expect(onTelemetry).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'success',
                decoderSource: 'zxing',
                timeToFirstDecodeMs: 1500,
            }),
        )
        expect(html5QrcodeMocks.stop).toHaveBeenCalled()
    })

    it('captures categorized failure telemetry buckets', async () => {
        const onTelemetry = vi.fn()

        html5QrcodeMocks.start.mockImplementationOnce(
            async (
                _camera: unknown,
                _config: unknown,
                _onSuccess: (decodedText: string, result?: unknown) => void,
                onError: (errorMessage: string) => void,
            ) => {
                setTimeout(() => onError('NotFoundException: no code found'), 100)
                setTimeout(() => onError('OverconstrainedError: unsupported constraint'), 1300)
                return null
            },
        )

        render(<QRScanner onScan={vi.fn()} onTelemetry={onTelemetry} />)

        await act(async () => {
            vi.advanceTimersByTime(300)
            await Promise.resolve()
        })

        await act(async () => {
            vi.advanceTimersByTime(1800)
            await Promise.resolve()
        })

        expect(onTelemetry).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'failure',
                bucket: 'no_code_found',
            }),
        )
        expect(onTelemetry).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'failure',
                bucket: 'constraints',
            }),
        )
    })
})
