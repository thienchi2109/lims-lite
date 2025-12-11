'use client'

import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Camera, X, ScanLine } from 'lucide-react'

interface QRScannerProps {
    onScan: (decodedText: string) => void
    onError?: (error: string) => void
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(false)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const elementId = 'qr-reader'
    const scannerInitializedRef = useRef(false)
    const lastErrorTimeRef = useRef<number>(0)

    const startScanning = async () => {
        try {
            setError(null)
            setIsInitializing(true)

            // Wait for DOM element to be ready
            await new Promise(resolve => setTimeout(resolve, 100))

            const html5QrCode = new Html5Qrcode(elementId)
            scannerRef.current = html5QrCode
            scannerInitializedRef.current = true

            await html5QrCode.start(
                { facingMode: 'environment' }, // Use back camera on mobile
                {
                    fps: 10,
                    qrbox: function (viewfinderWidth, viewfinderHeight) {
                        // Responsive QR box sizing
                        const minEdgePercentage = 0.7 // 70% of the smaller edge
                        const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
                        const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage)
                        return {
                            width: qrboxSize,
                            height: qrboxSize
                        }
                    },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
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
                        // Only log non-NotFoundException errors
                        if (!errorMessage.includes('NotFoundException')) {
                            // Use requestAnimationFrame to avoid blocking
                            requestAnimationFrame(() => {
                                console.warn('QR scan error:', errorMessage)
                            })
                        }
                    }
                }
            )

            setIsScanning(true)
            setIsInitializing(false)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Không thể khởi động máy ảnh'
            setError(errorMsg)
            onError?.(errorMsg)
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
