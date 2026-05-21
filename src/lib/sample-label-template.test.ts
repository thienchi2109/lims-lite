import { describe, expect, it } from 'vitest'
import { generateSampleLabelHtml } from './sample-label-template'
import type { SampleWithUser } from '@/types'

const sensitiveSample = {
    id: '11111111-1111-4111-8111-111111111111',
    sample_id: 'CDC-XN-21052026-0001',
    client_id: '22222222-2222-4222-8222-222222222222',
    client_name: 'Nguyen Van HIV',
    type: 'Máu',
    status: 'assigned',
    received_at: '2026-05-21T08:35:00.000Z',
    received_by: '33333333-3333-4333-8333-333333333333',
    received_by_name: 'Tran Thi Binh',
    created_at: '2026-05-21T08:35:00.000Z',
    updated_at: '2026-05-21T08:35:00.000Z',
    deleted_at: null,
    rejection_reason: null,
    rejected_at: null,
    rejected_by: null,
} as SampleWithUser

describe('generateSampleLabelHtml', () => {
    it('renders a small tube label with only privacy-safe sample metadata', () => {
        const html = generateSampleLabelHtml(sensitiveSample, { preset: 'small-tube' })

        expect(html).toContain('@page')
        expect(html).toContain('40mm')
        expect(html).toContain('15mm')
        expect(html).toContain('CDC-XN-21052026-0001')
        expect(html).toContain('Máu')
        expect(html).toContain('21/05 08:35')
        expect(html).toContain('TTB')
        expect(html).toContain('<svg')
        expect(html).toContain('aria-label="Barcode CDC-XN-21052026-0001"')

        expect(html).not.toContain('Nguyen Van HIV')
        expect(html).not.toContain('0912345678')
        expect(html).not.toContain('012345678901')
        expect(html).not.toContain('HIV')
        expect(html).not.toContain('confidential')
        expect(html).not.toContain('xét nghiệm HIV')
        expect(html).not.toContain('/coa/access')
        expect(html).not.toContain('token')
    })

    it('uses the full receiver name only on the larger container label', () => {
        const html = generateSampleLabelHtml(sensitiveSample, { preset: 'container' })

        expect(html).toContain('50mm')
        expect(html).toContain('25mm')
        expect(html).toContain('Tran Thi Binh')
    })
})
