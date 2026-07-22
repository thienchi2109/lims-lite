import { normalizeToIsoDateString } from '@/lib/iso-date'
import { parseClientIdentityQr } from '@/lib/qr/parse-client-identity-qr'

import type { ScannerEvent } from './scanner-event'

const SAMPLE_CODE_PATTERN = /^CDC-XN-(\d{8})-\d{4,}$/

function hasValidSampleDate(dateToken: string): boolean {
    const day = dateToken.slice(0, 2)
    const month = dateToken.slice(2, 4)
    const year = dateToken.slice(4, 8)

    return normalizeToIsoDateString(`${day}/${month}/${year}`) !== null
}

export function classifyScannerPayload(payload: string): ScannerEvent {
    const identity = parseClientIdentityQr(payload)
    if (identity) {
        return {
            kind: 'identity-qr',
            identity,
        }
    }

    const sampleCodeMatch = SAMPLE_CODE_PATTERN.exec(payload)
    if (sampleCodeMatch && hasValidSampleDate(sampleCodeMatch[1])) {
        return {
            kind: 'sample-code',
            code: payload,
        }
    }

    return { kind: 'unknown' }
}
