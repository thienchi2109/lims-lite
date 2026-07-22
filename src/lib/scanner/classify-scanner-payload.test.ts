import { describe, expect, it } from 'vitest'

import { classifyScannerPayload } from './classify-scanner-payload'

describe('classifyScannerPayload', () => {
    it('classifies a valid identity QR without retaining the raw frame', () => {
        const rawPayload =
            '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|Cần Thơ|10052021'

        const event = classifyScannerPayload(rawPayload)

        expect(event).toEqual({
            kind: 'identity-qr',
            identity: {
                idCardNum: '086094006827',
                name: 'Nguyễn Thiện Chí',
                dateOfBirth: '1994-09-21',
                gender: 'Nam',
                address: 'Cần Thơ',
            },
        })
        expect(event).not.toHaveProperty('raw')
        expect(JSON.stringify(event)).not.toContain(rawPayload)
    })

    it.each(['CDC-XN-22072026-0001', 'CDC-XN-29022024-123456'])(
        'classifies a valid sample code: %s',
        (code) => {
            expect(classifyScannerPayload(code)).toEqual({
                kind: 'sample-code',
                code,
            })
        },
    )

    it.each([
        'CDC-XN-31022026-0001',
        'CDC-XN-29022025-0001',
        'CDC-XN-20260722-0001',
        'cdc-xn-22072026-0001',
        'CDC-XN-22072026-001',
        'ABC123',
        '086094006827|Nguyễn Thiện Chí|not-a-date',
    ])('returns a payload-free unknown event for rejected input: %s', (payload) => {
        const event = classifyScannerPayload(payload)

        expect(event).toEqual({ kind: 'unknown' })
        expect(event).not.toHaveProperty('payload')
        expect(event).not.toHaveProperty('raw')
        expect(JSON.stringify(event)).not.toContain(payload)
    })
})
