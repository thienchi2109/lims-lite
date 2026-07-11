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

import {
    fetchSampleWithApprover,
    fetchTestResults,
    validateSampleForCoAGeneration,
} from './helpers'

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

function createSampleQuery(status: string) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        single: vi.fn(async () => ({
            data: { id: 'sample-1', status },
            error: null,
        })),
    }

    return query
}

function createValidationResultsQuery(data: unknown[]) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(async () => ({ data, error: null })),
    }

    return query
}

function createSampleWithClientQuery() {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        single: vi.fn(async () => ({
            data: {
                id: 'sample-1',
                sample_id: 'S-001',
                type: 'Máu',
                received_at: '2026-07-11T00:00:00.000Z',
                status: 'completed',
                clients: { name: 'Nguyễn Văn A' },
            },
            error: null,
        })),
    }

    return query
}

function createApproverQuery() {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        not: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        single: vi.fn(async () => ({
            data: {
                approved_by: 'manager-1',
                approved_at: '2026-07-11T00:00:00.000Z',
            },
            error: null,
        })),
    }

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

describe('validateSampleForCoAGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects manager final CoA generation while the sample is still under review', async () => {
        mockFrom.mockReturnValue(createSampleQuery('review'))

        const result = await validateSampleForCoAGeneration('sample-1')

        expect(result).toEqual({
            valid: false,
            error: 'Chỉ có thể tạo CoA cuối cùng cho mẫu đã hoàn thành',
        })
        expect(mockFrom).toHaveBeenCalledTimes(1)
    })

    it('requires every result to be approved for manager final CoA generation', async () => {
        mockFrom
            .mockReturnValueOnce(createSampleQuery('completed'))
            .mockReturnValueOnce(createValidationResultsQuery([
                { id: 'result-1', status: 'approved' },
                { id: 'result-2', status: 'entered' },
            ]))

        const result = await validateSampleForCoAGeneration('sample-1')

        expect(result).toEqual({
            valid: false,
            error: 'Không thể tạo CoA: 1 kết quả chưa được phê duyệt',
        })
    })
})

describe('fetchSampleWithApprover', () => {
    it('breaks approval timestamp ties by result id', async () => {
        const approverQuery = createApproverQuery()
        mockFrom
            .mockReturnValueOnce(createSampleWithClientQuery())
            .mockReturnValueOnce(approverQuery)

        await fetchSampleWithApprover('sample-1')

        expect(approverQuery.order).toHaveBeenNthCalledWith(
            1,
            'approved_at',
            { ascending: false },
        )
        expect(approverQuery.order).toHaveBeenNthCalledWith(
            2,
            'id',
            { ascending: false },
        )
    })
})
