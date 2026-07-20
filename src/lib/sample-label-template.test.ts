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
    client: {
        name: 'Nguyen Van A',
        date_of_birth: '1991-02-03',
    },
    created_at: '2026-05-21T08:35:00.000Z',
    updated_at: '2026-05-21T08:35:00.000Z',
    deleted_at: null,
    rejection_reason: null,
    rejected_at: null,
    rejected_by: null,
} as SampleWithUser

describe('generateSampleLabelHtml', () => {
    it('keeps the legacy two-column thermal label geometry available', () => {
        const html = generateSampleLabelHtml(sensitiveSample, { preset: 'thermal-35x22-2up' })

        expect(html).toContain('size: 72mm 22mm')
        expect(html).toContain('grid-template-columns: 35mm 35mm')
        expect(html).toContain('column-gap: 2mm')
        expect(html).toContain('width: 35mm')
        expect(html).toContain('height: 22mm')
        expect(html).toContain('font-size: 6.5pt')
        expect(html.match(/class="sample-label"/g)).toHaveLength(2)
        expect(html.match(/CDC-XN-21052026-0001/g)?.length).toBeGreaterThanOrEqual(2)
    })

    it('keeps the 89mm physical stock page separate from its 22.9mm label row', () => {
        const html = generateSampleLabelHtml(sensitiveSample)

        expect(html).toContain('size: 71.1mm 89mm')
        expect(html).toContain('grid-template-columns: 35.5mm 35.5mm')
        expect(html).toContain('column-gap: 0mm')
        expect(html).toContain('width: 35.5mm')
        expect(html).toContain('height: 22.9mm')
        expect(html).toMatch(/html,\s+body \{\s+width: 71\.1mm;\s+height: 22\.9mm;/)
        expect(html).toMatch(/\.label-sheet \{\s+width: 71\.1mm;\s+height: 22\.9mm;/)
        expect(html).not.toContain('size: 71.1mm 22.9mm')
        expect(html).toContain('font-size: 6.5pt')
        expect(html.match(/class="sample-label"/g)).toHaveLength(2)
        expect(html.match(/CDC-XN-21052026-0001/g)?.length).toBeGreaterThanOrEqual(2)
    })

    it('renders the standard two-column stock with one label row at the top', () => {
        const html = generateSampleLabelHtml(sensitiveSample, { preset: 'thermal-35x23-sheet-2up' })

        expect(html).toContain('size: 71.1mm 89mm')
        expect(html).toContain('grid-template-columns: 35.5mm 35.5mm')
        expect(html).toContain('column-gap: 0mm')
        expect(html).toContain('width: 35.5mm')
        expect(html).toContain('height: 22.9mm')
        expect(html).toMatch(/html,\s+body \{\s+width: 71\.1mm;\s+height: 22\.9mm;/)
        expect(html).toMatch(/\.label-sheet \{\s+width: 71\.1mm;\s+height: 22\.9mm;/)
        expect(html).not.toContain('size: 71.1mm 22.9mm')
    })

    it('keeps 35x22mm thermal label content inside a printer-safe inset', () => {
        const html = generateSampleLabelHtml(sensitiveSample, { preset: 'thermal-35x22-2up' })

        expect(html).toContain('padding: 2mm 2mm 1mm 3mm')
    })

    it('renders patient identity metadata without sample type, collection time, or receiver on labels', () => {
        const html = generateSampleLabelHtml(sensitiveSample, { preset: 'small-tube' })

        expect(html).toContain('@page')
        expect(html).toContain('40mm')
        expect(html).toContain('15mm')
        expect(html).toContain('CDC-XN-21052026-0001')
        expect(html).toContain('Nguyen Van A')
        expect(html).toContain('1991')
        expect(html).toContain('<svg')
        expect(html).toContain('aria-label="Barcode CDC-XN-21052026-0001"')

        expect(html).not.toContain('Máu')
        expect(html).not.toContain('21/05 08:35')
        expect(html).not.toContain('Tran Thi Binh')
        expect(html).not.toContain('TTB')
        expect(html).not.toContain('0912345678')
        expect(html).not.toContain('012345678901')
        expect(html).not.toContain('confidential')
        expect(html).not.toContain('xét nghiệm HIV')
        expect(html).not.toContain('/coa/access')
        expect(html).not.toContain('token')
    })

    it('uses compact metadata text for long patient names on 35x22mm labels', () => {
        const html = generateSampleLabelHtml({
            ...sensitiveSample,
            client: {
                name: 'Nguyen Thi Minh Chau Phuong',
                date_of_birth: '1988-09-10',
            },
        }, { preset: 'thermal-35x22-2up' })

        expect(html).toContain('Nguyen Thi Minh Chau Phuong')
        expect(html).toContain('1988')
        expect(html).toContain('class="meta compact"')
        expect(html).not.toContain('21/05 08:35')
        expect(html).not.toContain('Tran Thi Binh')
    })

    it('keeps patient metadata glyphs clear of the barcode clipping edge', () => {
        const html = generateSampleLabelHtml({
            ...sensitiveSample,
            client: {
                name: 'Nguyễn Thị Ánh Hồng',
                date_of_birth: '1991-02-03',
            },
        }, { preset: 'thermal-35x22-2up' })

        expect(html).toContain('line-height: 1.2')
        expect(html).toContain('padding-top: 0.2mm')
        expect(html).toContain('Nguyễn Thị Ánh Hồng')
    })

    it('keeps patient identity metadata on the larger container label', () => {
        const html = generateSampleLabelHtml(sensitiveSample, { preset: 'container' })

        expect(html).toContain('50mm')
        expect(html).toContain('25mm')
        expect(html).toContain('Nguyen Van A')
        expect(html).toContain('1991')
        expect(html).not.toContain('Tran Thi Binh')
    })
})
