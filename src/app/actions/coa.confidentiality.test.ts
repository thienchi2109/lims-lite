import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.hoisted(() => vi.fn())
const mockGetUserConfidentialAccess = vi.hoisted(() => vi.fn())
const mockIsConfidentialAssociatedSample = vi.hoisted(() => vi.fn())
const mockValidateSampleForCoAGeneration = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/data/confidential-samples', () => ({
    getUserConfidentialAccess: (...args: unknown[]) =>
        mockGetUserConfidentialAccess(...args),
    isConfidentialAssociatedSample: (...args: unknown[]) =>
        mockIsConfidentialAssociatedSample(...args),
}))

vi.mock('@/app/actions/signatures', () => ({
    getActiveSignature: vi.fn(),
    downloadSignature: vi.fn(),
}))

vi.mock('@/lib/coa/helpers', () => ({
    fetchSampleWithApprover: vi.fn(),
    fetchTestingDate: vi.fn(),
    fetchTestResults: vi.fn(),
    generateHtmlHash: vi.fn(),
    validateSampleForCoAGeneration: (...args: unknown[]) =>
        mockValidateSampleForCoAGeneration(...args),
    fetchLatestSubmission: vi.fn(),
    fetchSignatureDataUri: vi.fn(),
}))

vi.mock('@/lib/coa/template', () => ({
    renderCoATemplate: vi.fn(),
}))

import { generateCoA, regenerateCoA } from './coa'

type QueryResult = {
    data: unknown
    error: { message: string } | null
}

function createThenableQuery(result: QueryResult) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        maybeSingle: vi.fn(async () => result),
        single: vi.fn(async () => result),
        then: (
            onFulfilled: (value: QueryResult) => unknown,
            onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(onFulfilled, onRejected),
    }

    return query
}

function mockCoAClient(role: 'analyst' | 'manager') {
    const from = vi.fn((table: string) => {
        if (table === 'users') {
            return createThenableQuery({
                data: {
                    role,
                },
                error: null,
            })
        }

        throw new Error(`Unexpected table: ${table}`)
    })

    mockCreateClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: {
                    user: {
                        id: 'staff-1',
                    },
                },
                error: null,
            }),
        },
        from,
    })

    return { from }
}

describe('CoA confidentiality actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUserConfidentialAccess.mockResolvedValue({
            canAccessConfidential: false,
        })
        mockIsConfidentialAssociatedSample.mockResolvedValue({
            data: true,
        })
        mockValidateSampleForCoAGeneration.mockResolvedValue({
            valid: false,
            error: 'Không có kết quả xét nghiệm cho mẫu này',
        })
    })

    it('masks generateCoA for confidential samples when staff lacks confidential access', async () => {
        mockCoAClient('analyst')

        const result = await generateCoA('sample-1')

        expect(result).toEqual({
            success: false,
            error: 'Không tìm thấy thông tin mẫu',
        })
        expect(mockValidateSampleForCoAGeneration).not.toHaveBeenCalled()
    })

    it('masks regenerateCoA for confidential samples when manager lacks confidential access', async () => {
        const { from } = mockCoAClient('manager')

        const result = await regenerateCoA('sample-1')

        expect(result).toEqual({
            success: false,
            error: 'Không tìm thấy thông tin mẫu',
        })
        expect(mockValidateSampleForCoAGeneration).not.toHaveBeenCalled()
        expect(from).toHaveBeenCalledTimes(1)
    })

    it('lets authorized staff continue into the normal generation validation path', async () => {
        mockCoAClient('analyst')
        mockGetUserConfidentialAccess.mockResolvedValue({
            canAccessConfidential: true,
        })
        mockValidateSampleForCoAGeneration.mockResolvedValue({
            valid: false,
            error: 'Không thể tạo CoA: 1 kết quả chưa được phê duyệt',
        })

        const result = await generateCoA('sample-1')

        expect(result).toEqual({
            success: false,
            error: 'Không thể tạo CoA: 1 kết quả chưa được phê duyệt',
        })
        expect(mockValidateSampleForCoAGeneration).toHaveBeenCalledWith(
            'sample-1',
        )
        expect(mockIsConfidentialAssociatedSample).not.toHaveBeenCalled()
    })
})
