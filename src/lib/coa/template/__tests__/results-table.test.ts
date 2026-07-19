import { describe, expect, it } from 'vitest'

import { renderResultsTable } from '../results-table'
import type { TestResult } from '../../helpers'

describe('renderResultsTable', () => {
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
        expect(html).not.toContain('<th width="18%">Đánh giá</th>')
    })
})
