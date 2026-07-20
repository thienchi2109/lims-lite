import { describe, expect, it } from 'vitest'

import { renderResultsTable } from '../results-table'
import type { TestResult } from '../../helpers'

function getColumnWidths(html: string): number[] {
    return [...html.matchAll(/<col style="width: (\d+)%;">/g)]
        .map(match => Number(match[1]))
}

function renderRangeCell(normalRange: string | null): string {
    const html = renderResultsTable([
        {
            assay_name: 'Xét nghiệm',
            value: '1',
            unit: 'U/L',
            normal_range: normalRange,
            method_name: 'Phương pháp',
            lab_specialty_name: null,
        },
    ])

    return html.match(/<td class="res-range">(.*?)<\/td>/s)?.[1] || ''
}

describe('renderResultsTable', () => {
    it('allocates the six release columns to exactly 100 percent', () => {
        const html = renderResultsTable([])

        expect(getColumnWidths(html)).toEqual([5, 25, 15, 10, 25, 20])
    })

    it('allocates the seven draft columns to exactly 100 percent', () => {
        const html = renderResultsTable([], { showAssessment: true })

        expect(getColumnWidths(html)).toEqual([5, 23, 11, 8, 25, 14, 14])
    })

    it('preserves Acid Uric gender ranges as semantic lines', () => {
        const results: TestResult[] = [
            {
                assay_name: 'Acid Uric',
                value: '125',
                unit: 'µmol/L',
                normal_range: 'Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                lab_specialty_name: 'Sinh hóa',
            },
        ]

        const html = renderResultsTable(results)

        expect(html).toContain(
            '<span class="res-range-line"><span class="res-range-label">Nam: </span><span class="res-range-measurement">208 - 428 µmol/L</span></span>',
        )
        expect(html).toContain(
            '<span class="res-range-line"><span class="res-range-label">Nữ: </span><span class="res-range-measurement">155 - 357 µmol/L</span></span>',
        )
    })

    it.each([null, '', ' \r\n '])(
        'renders an empty reference-range cell for %s',
        (normalRange) => {
            expect(renderRangeCell(normalRange)).toBe('')
        },
    )

    it('renders short text and a single measurement without extra lines', () => {
        expect(renderRangeCell('Âm tính')).toBe(
            '<span class="res-range-line">Âm tính</span>',
        )
        expect(renderRangeCell('4,1 - 5,9 mmol/L')).toBe(
            '<span class="res-range-line"><span class="res-range-measurement">4,1 - 5,9 mmol/L</span></span>',
        )
    })

    it('normalizes line endings and removes blank semantic lines', () => {
        const rangeCell = renderRangeCell(
            'Sơ sinh: 10 - 20 mg/L\r\n\rTrẻ em: 8 - 15 mg/L\nNgười lớn: 5 - 10 mg/L',
        )

        expect(rangeCell.match(/class="res-range-line"/g)).toHaveLength(3)
        expect(rangeCell).toContain('Sơ sinh: ')
        expect(rangeCell).toContain('Trẻ em: ')
        expect(rangeCell).toContain('Người lớn: ')
    })

    it('allows deterministic wrapping for long and unbroken content', () => {
        const longMeasurement = renderRangeCell(
            'Nam: 1234567890123456789012345 µmol/L',
        )
        const longText = renderRangeCell(
            'Kết quả cần được đối chiếu với tuổi thai và tình trạng lâm sàng',
        )
        const unbrokenText = renderRangeCell(
            'KhôngPhátHiệnKhôngPhátHiệnKhôngPhátHiệnKhôngPhátHiện',
        )

        expect(longMeasurement).not.toContain('res-range-measurement')
        expect(longText).toContain('class="res-range-line"')
        expect(unbrokenText).toContain('class="res-range-line"')
    })

    it('applies nowrap only through the 24-code-point measurement limit', () => {
        expect(renderRangeCell('123456789012345678901234')).toContain(
            'class="res-range-measurement"',
        )
        expect(renderRangeCell('1234567890123456789012345')).not.toContain(
            'class="res-range-measurement"',
        )
    })

    it('escapes labels, measurements, and special unit characters', () => {
        const rangeCell = renderRangeCell(
            '<b>Positive</b>: ≥ 0,3 µg/(kg·ngày) & <script>alert(1)</script>',
        )

        expect(rangeCell).toContain('&lt;b&gt;Positive&lt;/b&gt;: ')
        expect(rangeCell).toContain('&amp; &lt;script&gt;alert(1)&lt;/script&gt;')
        expect(rangeCell).not.toContain('<script>')
    })

    it('emphasizes only results assessed outside the reference range', () => {
        const results: TestResult[] = [
            {
                result_id: '11111111-1111-4111-8111-111111111111',
                assay_name: 'Glucose',
                value: '5,2',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                lab_specialty_name: 'Sinh hóa',
            },
            {
                result_id: '22222222-2222-4222-8222-222222222222',
                assay_name: 'Glucose đói',
                value: '8,2',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                lab_specialty_name: 'Sinh hóa',
            },
            {
                result_id: '33333333-3333-4333-8333-333333333333',
                assay_name: 'Glucose sau ăn',
                value: '7,1',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                lab_specialty_name: 'Sinh hóa',
            },
        ]

        const html = renderResultsTable(results, {
            assessments: {
                '11111111-1111-4111-8111-111111111111': 'within_reference_range',
                '22222222-2222-4222-8222-222222222222': 'outside_reference_range',
            },
        })

        expect(html).toContain('Khoảng tham chiếu')
        expect(html).toContain('4,1 - 5,9 mmol/L')
        expect(html).toContain('<td class="res-value">5,2</td>')
        expect(html).toContain(
            '<td class="res-value res-value-outside-reference-range">8,2</td>',
        )
        expect(html).toContain('<td class="res-value">7,1</td>')
        expect(html).not.toContain('<th>Đánh giá</th>')
    })
})
