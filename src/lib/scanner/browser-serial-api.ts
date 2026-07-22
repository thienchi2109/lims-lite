import { getWebSerialApi } from './web-serial-scanner'

export function getBrowserScannerSerialApi() {
    if (typeof window === 'undefined') return null

    return getWebSerialApi(
        window.navigator as Navigator & {
            serial?: {
                requestPort?: unknown
                getPorts?: unknown
            }
        },
    )
}
