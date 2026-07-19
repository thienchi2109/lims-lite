import { describe, expect, it } from 'vitest'

import {
    buildCoaPdfFilename,
    formatCoaPdfDate,
    sanitizeCoaSampleIdForFilename,
} from './filename'

describe('sanitizeCoaSampleIdForFilename', () => {
    it('keeps a conservative filename-safe sample ID segment', () => {
        expect(sanitizeCoaSampleIdForFilename(' ../XN 2026/001?. ')).toBe(
            'XN-2026-001',
        )
    })

    it('uses a deterministic fallback when no safe characters remain', () => {
        expect(sanitizeCoaSampleIdForFilename('../...///')).toBe('MauXetNghiem')
    })
})

describe('formatCoaPdfDate', () => {
    it('formats generated_at before the Ho Chi Minh City day boundary', () => {
        expect(formatCoaPdfDate('2026-07-19T16:59:59.999Z')).toBe('20260719')
    })

    it('formats generated_at after the Ho Chi Minh City day boundary', () => {
        expect(formatCoaPdfDate('2026-07-19T17:00:00.000Z')).toBe('20260720')
    })

    it('rejects an invalid generated_at timestamp', () => {
        expect(() => formatCoaPdfDate('not-a-date')).toThrow(
            'Invalid CoA generated_at timestamp',
        )
    })
})

describe('buildCoaPdfFilename', () => {
    it('builds the deterministic attachment filename', () => {
        expect(
            buildCoaPdfFilename(
                'XN 2026/001',
                new Date('2026-07-19T17:00:00.000Z'),
            ),
        ).toBe('PhieuKetQuaXN-XN-2026-001-20260720.pdf')
    })
})
