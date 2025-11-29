'use client'

import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Camera, X } from 'lucide-react'

interface QRScannerProps {
    onScan: (decodedText: string) => void
    onError?: (error: string) => void
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const elementId = 'qr-reader'

    const startScanning = async () => {
        try {
            setError(null)
            const html5QrCode = new Html5Qrcode(elementId)
            scannerRef.current = html5QrCode

            await html5QrCode.start(
                { facingMode: 'environment' }, // Use back camera on mobile
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
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
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Không thể khởi động máy ảnh'
            setError(errorMsg)
            onError?.(errorMsg)
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
            {!isScanning ? (
                <Button
                    type="button"
                    variant="outline"
                    onClick={startScanning}
                    className="w-full"
                >
                    <Camera className="mr-2 h-4 w-4" />
                    Quét mã QR
                </Button>
            ) : (
                <div className="space-y-2">
                    <div
                        id={elementId}
                        className="rounded-lg overflow-hidden border-2 border-primary"
                    />
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={stopScanning}
                        className="w-full"
                    >
                        <X className="mr-2 h-4 w-4" />
                        Dừng quét
                    </Button>
                </div>
            )}

            {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {error}
                </div>
            )}
        </div>
    )
}
