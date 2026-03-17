'use client'

import { useState, useRef, useEffect } from 'react'
import type { Html5QrcodeResult } from 'html5-qrcode'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
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
    const scannerInitializedRef = useRef(false)
    const lastErrorTimeRef = useRef<number>(0)
    const scanStartedAtRef = useRef<number | null>(null)
    const didEmitSuccessTelemetryRef = useRef(false)
    const usedCompatibilityModeRef = useRef(false)

    const startScanning = async () => {
        try {
            setError(null)
            setIsInitializing(true)

            // Wait for DOM element to be ready
            await new Promise(resolve => setTimeout(resolve, 100))

            const html5QrCode = new Html5Qrcode(elementId, createCccdScannerFullConfig())
            scannerRef.current = html5QrCode
            scannerInitializedRef.current = true
            setScanGuidance(DEFAULT_GUIDANCE)
            didEmitSuccessTelemetryRef.current = false
            usedCompatibilityModeRef.current = false
            scanStartedAtRef.current = Date.now()

            const startWithConfig = async (scanConfig = createPreferredCameraScanConfig()) => html5QrCode.start(
                { facingMode: 'environment' }, // Use back camera on mobile
                scanConfig,
                (decodedText, result?: Html5QrcodeResult) => {
                    if (!didEmitSuccessTelemetryRef.current) {
                        didEmitSuccessTelemetryRef.current = true
                        const startedAt = scanStartedAtRef.current ?? Date.now()
                        const timeToFirstDecodeMs = Math.max(0, Date.now() - startedAt)
                        onTelemetry?.({
                            type: 'success',
                            timeToFirstDecodeMs,
                            decoderSource: detectDecoderSource(result),
                            usedCompatibilityMode: usedCompatibilityModeRef.current,
                        })
                    }

                    // Successfully scanned
                    onScan(decodedText)
                    stopScanning()
                },
                (errorMessage) => {
                    // Throttle error logging to prevent message handler violations
                    // Only process errors once per second
                    const now = Date.now()
                    if (now - lastErrorTimeRef.current > 1000) {
                        lastErrorTimeRef.current = now
                        const bucket = categorizeScanFailure(errorMessage)
                        onTelemetry?.({
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
                            // Use requestAnimationFrame to avoid blocking
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
                onTelemetry?.({
                    type: 'failure',
                    bucket: 'constraints',
                    message: getErrorMessage(runtimeError),
                })
            }

            setIsScanning(true)
            setIsInitializing(false)
        } catch (err) {
            const errorMsg = getErrorMessage(err)
            setError(errorMsg)
            onError?.(errorMsg)
            onTelemetry?.({
                type: 'failure',
                bucket: categorizeScanFailure(errorMsg),
                message: errorMsg,
            })
            setIsInitializing(false)
            console.error('Error starting QR scanner:', err)
        }
    }

    const stopScanning = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop()
                scannerRef.current.clear()
                scannerRef.current = null
                setIsScanning(false)
            } catch (err) {
                console.error('Error stopping QR scanner:', err)
            }
        }
    }

    // Initialize scanner when element is mounted
    useEffect(() => {
        if (isScanning && !scannerInitializedRef.current) {
            startScanning()
        }
    }, [isScanning])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(console.error)
            }
        }
    }, [])

    // Auto-start scanning when component mounts
    useEffect(() => {
        if (!isScanning && !isInitializing) {
            setIsInitializing(true)
            setIsScanning(true)
        }
    }, [])

    return (
        <div className="space-y-4">
            {isScanning || isInitializing ? (
                <div className="space-y-3">
                    {/* Camera Preview with Glassmorphism Border */}
                    <div className="relative rounded-xl overflow-hidden border-2 border-sky-500 dark:border-sky-400 shadow-lg">
                        <div
                            id={elementId}
                            className="w-full aspect-square bg-slate-900"
                        />
                        {/* Scanning Indicator Overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-4 left-4 right-4 flex justify-center">
                                <div className="bg-slate-900/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                        <span className="font-medium">
                                            {isInitializing ? 'Đang khởi động...' : 'Đang quét...'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stop Button - Touch Friendly with 8px gap */}
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={stopScanning}
                        disabled={isInitializing}
                        className="w-full min-h-[48px] text-base font-medium transition-colors duration-200"
                        aria-label="Dừng quét mã QR"
                    >
                        <X className="mr-2 h-5 w-5" />
                        Dừng quét
                    </Button>

                    <div className="rounded-lg border border-sky-200/70 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                        {scanGuidance}
                    </div>
                </div>
            ) : null}

            {/* Error Display with Better Styling */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 text-sm p-4 rounded-lg shadow-sm">
                    <p className="font-medium mb-1">Lỗi máy ảnh</p>
                    <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}
        </div>
    )
}
