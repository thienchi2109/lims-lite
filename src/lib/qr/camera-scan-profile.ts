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
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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

type RangeCapability = {
    min: number
    max: number
    step?: number
}

type RuntimeTrackCapabilities = Partial<MediaTrackCapabilities> & {
    zoom?: RangeCapability
    torch?: boolean
    focusMode?: string[]
    focusDistance?: RangeCapability
}

type RuntimeTrackSettings = Partial<MediaTrackSettings> & {
    zoom?: number
    torch?: boolean
}

type RuntimeTrackConstraints = MediaTrackConstraints & {
    zoom?: number
    torch?: boolean
    focusMode?: string
    focusDistance?: number
}

type DecoderResultLike = {
    result?: {
        debugData?: {
            decoderName?: string
        }
    }
}

function isRangeCapability(value: unknown): value is RangeCapability {
    if (!value || typeof value !== 'object') return false
    const range = value as Partial<RangeCapability>
    return typeof range.min === 'number' && typeof range.max === 'number'
}

function resolvePreferredZoom(range: RangeCapability, currentZoom?: number) {
    const step = typeof range.step === 'number' && range.step > 0 ? range.step : 0.1
    const baseline = typeof currentZoom === 'number' ? currentZoom : range.min
    const target = baseline + step * 2
    return Math.max(range.min, Math.min(range.max, Number(target.toFixed(2))))
}

export function buildRuntimeEnhancementConstraints(
    capabilities: RuntimeTrackCapabilities,
    settings: RuntimeTrackSettings,
): RuntimeTrackConstraints | null {
    const runtimeConstraints: RuntimeTrackConstraints = {}

    if (isRangeCapability(capabilities.zoom)) {
        runtimeConstraints.zoom = resolvePreferredZoom(capabilities.zoom, settings.zoom)
    }

    if (capabilities.torch === true && settings.torch !== true) {
        runtimeConstraints.torch = true
    }

    if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
        runtimeConstraints.focusMode = 'continuous'
    }

    if (isRangeCapability(capabilities.focusDistance)) {
        runtimeConstraints.focusDistance = capabilities.focusDistance.min
    }

    return Object.keys(runtimeConstraints).length > 0 ? runtimeConstraints : null
}

export type ScanFailureBucket =
    | 'no_code_found'
    | 'constraints'
    | 'permission'
    | 'camera_unavailable'
    | 'unknown'

export type DecoderSource = 'barcode-detector' | 'zxing' | 'unknown'

export type QrScanTelemetryEvent =
    | {
        type: 'success'
        timeToFirstDecodeMs: number
        decoderSource: DecoderSource
        usedCompatibilityMode: boolean
    }
    | {
        type: 'failure'
        bucket: ScanFailureBucket
        message: string
    }

export function categorizeScanFailure(errorMessage: string): ScanFailureBucket {
    const normalizedMessage = errorMessage.toLowerCase()

    if (normalizedMessage.includes('notfoundexception')) return 'no_code_found'
    if (normalizedMessage.includes('overconstrained') || normalizedMessage.includes('constraint')) return 'constraints'
    if (normalizedMessage.includes('notallowed') || normalizedMessage.includes('permission')) return 'permission'
    if (
        normalizedMessage.includes('notreadable') ||
        normalizedMessage.includes('notfounderror') ||
        normalizedMessage.includes('device not found')
    ) {
        return 'camera_unavailable'
    }

    return 'unknown'
}

export function detectDecoderSource(result?: DecoderResultLike): DecoderSource {
    const decoderName = result?.result?.debugData?.decoderName?.toLowerCase() ?? ''

    if (!decoderName) return 'unknown'
    if (decoderName.includes('zxing')) return 'zxing'
    if (decoderName.includes('barcode') || decoderName.includes('native')) return 'barcode-detector'

    return 'unknown'
}
