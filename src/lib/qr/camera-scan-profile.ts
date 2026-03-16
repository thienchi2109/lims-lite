import type { Html5QrcodeCameraScanConfig, Html5QrcodeFullConfig } from 'html5-qrcode'
import { Html5QrcodeSupportedFormats } from 'html5-qrcode'

const MIN_QRBOX_SIZE = 180
const MAX_QRBOX_SIZE = 420
const PREFERRED_QRBOX_RATIO = 0.58

export function createCccdScannerFullConfig(): Html5QrcodeFullConfig {
    return {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
    }
}

export function createPreferredCameraScanConfig(): Html5QrcodeCameraScanConfig {
    return {
        fps: 8,
        disableFlip: true,
        aspectRatio: 1.0,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
            const estimatedSize = Math.floor(minEdgeSize * PREFERRED_QRBOX_RATIO)
            const boundedSize = Math.max(MIN_QRBOX_SIZE, Math.min(estimatedSize, MAX_QRBOX_SIZE))
            return {
                width: boundedSize,
                height: boundedSize,
            }
        },
        videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
        },
    }
}

export function createCompatibilityCameraScanConfig(): Html5QrcodeCameraScanConfig {
    return {
        fps: 10,
        disableFlip: true,
        aspectRatio: 1.0,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
            const size = Math.floor(minEdgeSize * 0.7)
            return {
                width: size,
                height: size,
            }
        },
    }
}

export function shouldRetryWithCompatibilityMode(error: unknown) {
    const message = getErrorMessage(error).toLowerCase()
    return (
        message.includes('overconstrained') ||
        message.includes('constraint') ||
        message.includes('facingmode') ||
        message.includes('requested device not found')
    )
}

export function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    return 'Không thể khởi động máy ảnh'
}
