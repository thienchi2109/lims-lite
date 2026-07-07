import { describe, expect, it } from 'vitest'

import { renderResultsTable } from '../results-table'
import type { TestResult } from '../../helpers'

describe('renderResultsTable', () => {
    it('renders clinical reference ranges for CoA result rows', () => {
        const results: TestResult[] = [
            {
                assay_name: 'Glucose',
                value: '5,2',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                lab_specialty_name: 'Sinh hóa',
            },
        ]

        const html = renderResultsTable(results)

        expect(html).toContain('Khoảng tham chiếu')
        expect(html).toContain('4,1 - 5,9 mmol/L')
    })
})
