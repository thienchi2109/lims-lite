'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Html5QrcodeResult } from 'html5-qrcode'
import { Html5Qrcode } from 'html5-qrcode'
import {
    buildRuntimeEnhancementConstraints,
    categorizeScanFailure,
    createCccdScannerFullConfig,
    createCompatibilityCameraScanConfig,
    createPreferredCameraScanConfig,
    detectDecoderSource,
    getErrorMessage,
    type QrScanTelemetryEvent,
    shouldRetryWithCompatibilityMode,
} from '@/lib/qr/camera-scan-profile'

interface QRScannerProps {
    onScan: (decodedText: string) => void
    onError?: (error: string) => void
    onTelemetry?: (event: QrScanTelemetryEvent) => void
}

const DEFAULT_GUIDANCE =
    'Mẹo quét nhanh: Giữ mã QR trong khung, cách 10–15cm, đủ sáng và giữ máy ổn định.'
const COMPATIBILITY_GUIDANCE =
    'Thiết bị đang dùng chế độ tương thích. Nếu khó quét, tăng ánh sáng hoặc dùng máy quét USB/Bluetooth.'

export function QRScanner({ onScan, onError, onTelemetry }: QRScannerProps) {
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(false)
    const [scanGuidance, setScanGuidance] = useState(DEFAULT_GUIDANCE)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const elementId = 'qr-reader'
    const isStartingRef = useRef(false)
    const lastErrorTimeRef = useRef<number>(0)
    const scanStartedAtRef = useRef<number | null>(null)
    const didEmitSuccessTelemetryRef = useRef(false)
    const usedCompatibilityModeRef = useRef(false)

    // Callback refs — prevent startScanning identity changes on parent re-render
    const onScanRef = useRef(onScan)
    const onErrorRef = useRef(onError)
    const onTelemetryRef = useRef(onTelemetry)
    useEffect(() => { onScanRef.current = onScan }, [onScan])
    useEffect(() => { onErrorRef.current = onError }, [onError])
    useEffect(() => { onTelemetryRef.current = onTelemetry }, [onTelemetry])

    const stopScanning = useCallback(async () => {
        const scanner = scannerRef.current
        if (!scanner) return

        try {
            const state = scanner.getState()
            // Html5QrcodeState: NOT_STARTED=0, SCANNING=2, PAUSED=3
            if (state === 2 || state === 3) {
                await scanner.stop()
            }
            scanner.clear()
        } catch (err) {
            console.warn('Error stopping QR scanner:', err)
        } finally {
            scannerRef.current = null
            setIsScanning(false)
            isStartingRef.current = false
        }
    }, [])

    const startScanning = useCallback(async () => {
        // Prevent concurrent starts
        if (isStartingRef.current || scannerRef.current) return
        isStartingRef.current = true

        try {
            setError(null)
            setIsInitializing(true)

            // Wait for DOM element to be ready
            await new Promise(resolve => setTimeout(resolve, 150))

            // Verify DOM element exists before initializing
            const readerElement = document.getElementById(elementId)
            if (!readerElement) {
                throw new Error('Phần tử camera chưa sẵn sàng. Vui lòng thử lại.')
            }

            const html5QrCode = new Html5Qrcode(elementId, createCccdScannerFullConfig())
            scannerRef.current = html5QrCode
            setScanGuidance(DEFAULT_GUIDANCE)
            didEmitSuccessTelemetryRef.current = false
            usedCompatibilityModeRef.current = false
            scanStartedAtRef.current = Date.now()

            const startWithConfig = async (scanConfig = createPreferredCameraScanConfig()) =>
                html5QrCode.start(
                    { facingMode: 'environment' },
                    scanConfig,
                    (decodedText, result?: Html5QrcodeResult) => {
                        if (!didEmitSuccessTelemetryRef.current) {
                            didEmitSuccessTelemetryRef.current = true
                            const startedAt = scanStartedAtRef.current ?? Date.now()
                            const timeToFirstDecodeMs = Math.max(0, Date.now() - startedAt)
                            onTelemetryRef.current?.({
                                type: 'success',
                                timeToFirstDecodeMs,
                                decoderSource: detectDecoderSource(result),
                                usedCompatibilityMode: usedCompatibilityModeRef.current,
                            })
                        }

                        // Successfully scanned
                        onScanRef.current(decodedText)
                        void stopScanning()
                    },
                    (errorMessage) => {
                        // Throttle error logging to prevent message handler violations
                        const now = Date.now()
                        if (now - lastErrorTimeRef.current > 1000) {
                            lastErrorTimeRef.current = now
                            const bucket = categorizeScanFailure(errorMessage)
                            onTelemetryRef.current?.({
                                type: 'failure',
                                bucket,
                                message: errorMessage,
                            })

                            if (bucket === 'no_code_found') {
                                setScanGuidance(
                                    usedCompatibilityModeRef.current
                                        ? COMPATIBILITY_GUIDANCE
                                        : DEFAULT_GUIDANCE,
                                )
                            }

                            // Only log non-NotFoundException errors
                            if (!errorMessage.includes('NotFoundException')) {
                                requestAnimationFrame(() => {
                                    console.warn('QR scan error:', errorMessage)
                                })
                            }
                        }
                    },
                )

            try {
                await startWithConfig()
            } catch (startError) {
                if (!shouldRetryWithCompatibilityMode(startError)) {
                    throw startError
                }

                console.warn('Không áp dụng được cấu hình camera ưu tiên, chuyển sang chế độ tương thích.')
                usedCompatibilityModeRef.current = true
                setScanGuidance(COMPATIBILITY_GUIDANCE)
                await startWithConfig(createCompatibilityCameraScanConfig())
            }

            try {
                const capabilities = html5QrCode.getRunningTrackCapabilities()
                const settings = html5QrCode.getRunningTrackSettings()
                const runtimeConstraints = buildRuntimeEnhancementConstraints(capabilities, settings)

                if (runtimeConstraints) {
                    await html5QrCode.applyVideoConstraints(runtimeConstraints)
                }
            } catch (runtimeError) {
                console.warn('Không thể áp dụng tối ưu camera runtime:', runtimeError)
                onTelemetryRef.current?.({
                    type: 'failure',
                    bucket: 'constraints',
                    message: getErrorMessage(runtimeError),
                })
            }

            setIsScanning(true)
            setIsInitializing(false)
            isStartingRef.current = false
        } catch (err) {
            const errorMsg = getErrorMessage(err)
            setError(errorMsg)
            onErrorRef.current?.(errorMsg)
            onTelemetryRef.current?.({
                type: 'failure',
                bucket: categorizeScanFailure(errorMsg),
                message: errorMsg,
            })
            setIsInitializing(false)
            setIsScanning(false)
            // Clean up partial scanner state on failure
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear()
                } catch { /* ignore */ }
                scannerRef.current = null
            }
            isStartingRef.current = false
            console.error('Error starting QR scanner:', err)
        }
    }, [stopScanning])

    // Auto-start scanning once on mount, cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        void startScanning()

        return () => {
            void stopScanning()
        }
    }, [])

    // Camera failed — show minimal notice (some callers have no fallback UI)
    if (error && !isScanning && !isInitializing) {
        return (
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800/50 px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                Camera không khả dụng
            </div>
        )
    }

    if (!isScanning && !isInitializing) {
        return null
    }

    return (
        <div className="relative rounded-lg overflow-hidden bg-slate-900">
            <div
                id={elementId}
                className="w-full aspect-video"
            />
            {/* Scanning status pill */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-2 left-0 right-0 flex justify-center">
                    <div className="bg-slate-900/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full border border-white/10">
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                            <span className="font-medium">
                                {isInitializing ? 'Khởi động…' : 'Đang quét…'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
