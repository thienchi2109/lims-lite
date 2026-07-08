import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFrom = vi.fn()
let resultQuery: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
}

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: mockFrom,
    })),
}))

vi.mock('@/app/actions/signatures', () => ({
    getActiveSignature: vi.fn(),
    downloadSignature: vi.fn(),
}))

import { fetchTestResults } from './helpers'

function createResultQuery(data: unknown[]) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
    }

    query.eq
        .mockReturnValueOnce(query)
        .mockResolvedValueOnce({ data, error: null })

    return query
}

describe('fetchTestResults', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses assay normal_range for CoA reference range output', async () => {
        resultQuery = createResultQuery([
            {
                value: '5,2',
                assay_definitions: {
                    name: 'Glucose',
                    units: 'mmol/L',
                    normal_range: '4,1 - 5,9 mmol/L',
                    validation_rules: {},
                    lab_specialties: {
                        name: 'Sinh hóa',
                        display_order: 20,
                    },
                },
                methods: {
                    name: 'Máy sinh hóa tự động AU400',
                },
            },
        ])
        mockFrom.mockReturnValue(resultQuery)

        const results = await fetchTestResults('sample-1')

        expect(results).toEqual([
            {
                assay_name: 'Glucose',
                value: '5,2',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                lab_specialty_name: 'Sinh hóa',
            },
        ])
    })

    it('uses assay-owned method text when approved result has no catalog method', async () => {
        resultQuery = createResultQuery([
            {
                value: '1200',
                assay_definitions: {
                    name: 'HBV DNA',
                    units: 'IU/mL',
                    normal_range: null,
                    method_name: 'RT-PCR tự thiết lập',
                    validation_rules: {},
                    lab_specialties: {
                        name: 'Sinh học phân tử',
                        display_order: 10,
                    },
                },
                methods: null,
            },
        ])
        mockFrom.mockReturnValue(resultQuery)

        const results = await fetchTestResults('sample-1')

        expect(results[0]).toEqual(expect.objectContaining({
            assay_name: 'HBV DNA',
            method_name: 'RT-PCR tự thiết lập',
        }))
    })
})
