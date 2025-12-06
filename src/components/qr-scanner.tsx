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
                    qrbox: function(viewfinderWidth, viewfinderHeight) {
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
                    // Scanning error (can be ignored for continuous scanning)
                    // Only log critical errors
                    if (!errorMessage.includes('NotFoundException')) {
                        console.warn('QR scan error:', errorMessage)
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

    return (
        <div className="space-y-4">
            {!isScanning && !isInitializing ? (
                <div className="space-y-3">
                    {/* Info Card */}
                    <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-0.5">
                                <ScanLine className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                            </div>
                            <div className="space-y-1 min-w-0">
                                <p className="text-sm font-medium text-sky-900 dark:text-sky-100">
                                    Quét mã QR trên mẫu
                                </p>
                                <p className="text-xs text-sky-700 dark:text-sky-300">
                                    Đưa mã QR vào khung hình để tự động tìm kiếm
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Start Button - Touch Friendly */}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            setIsInitializing(true)
                            setIsScanning(true)
                        }}
                        className="w-full min-h-[48px] text-base font-medium hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 dark:hover:bg-sky-900/20 dark:hover:text-sky-300 dark:hover:border-sky-700 transition-colors duration-200"
                        aria-label="Bắt đầu quét mã QR"
                    >
                        <Camera className="mr-2 h-5 w-5" />
                        Bắt đầu quét
                    </Button>
                </div>
            ) : (
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
            )}

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
