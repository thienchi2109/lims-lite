import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSingle = vi.fn()
const mockSelectEq = vi.fn()
const mockUpdateEq = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()
const mockAdminFrom = vi.fn()
const mockRpc = vi.fn()
const mockRequireRole = vi.fn()
const mockIsAuthError = vi.fn()
const mockRevalidatePath = vi.fn()
const mockRejectedCountEqReceivedBy = vi.fn()
const mockRejectedCountNotRejectedAt = vi.fn()
const mockRejectedCountIsDeleted = vi.fn()
const mockRejectedCountEqStatus = vi.fn()
const mockUserSingle = vi.fn()
const mockUserEq = vi.fn()
const mockSamplesOrder = vi.fn()
const mockSamplesDeleted = vi.fn()
const mockSamplesEq = vi.fn()
const mockConfidentialEqStatus = vi.fn()
const mockConfidentialEqDeleted = vi.fn()
const mockConfidentialEqSample = vi.fn()
const mockApprovalCountDeleted = vi.fn()
const mockApprovalCountEqStatus = vi.fn()
const mockApprovalCountIn = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: mockFrom,
        rpc: mockRpc,
    })),
    createAdminClient: vi.fn(() => ({
        from: mockAdminFrom,
    })),
}))

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import {
    discardSample,
    getRejectedSamplesCount,
    getSamplesForApprovalCount,
    getSamplesWithTab,
    submitSampleForReview,
} from '@/app/actions/sample-approvals'

const TEST_SAMPLE_ID = 'a1111111-1111-4111-8111-111111111111'
const TEST_MANAGER_ID = 'b2222222-2222-4222-8222-222222222222'

describe('discardSample status gate', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockRequireRole.mockResolvedValue({ id: TEST_MANAGER_ID, role: 'manager' })

        mockSelectEq.mockReturnValue({ single: mockSingle })
        mockUpdate.mockReturnValue({ eq: mockUpdateEq })
        mockSelect.mockReturnValue({ eq: mockSelectEq })

        mockFrom.mockImplementation((table: string) => {
            if (table !== 'samples') {
                throw new Error(`Unexpected table: ${table}`)
            }
            return {
                select: mockSelect,
                update: mockUpdate,
            }
        })

        mockUpdateEq.mockResolvedValue({ error: null })
    })

    it('allows discarding samples in in_progress status', async () => {
        mockSingle.mockResolvedValue({
            data: { id: TEST_SAMPLE_ID, status: 'in_progress' },
            error: null,
        })

        const result = await discardSample({
            sampleId: TEST_SAMPLE_ID,
            reason: 'Discard after manager review',
        })

        expect(result).toEqual({ success: true })
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'discarded',
                rejection_reason: 'Discard after manager review',
                rejected_by: TEST_MANAGER_ID,
            }),
        )
        expect(mockRevalidatePath).toHaveBeenCalledWith('/manager/samples')
    })

    it('rejects non-discardable statuses (completed) and does not update', async () => {
        mockSingle.mockResolvedValue({
            data: { id: TEST_SAMPLE_ID, status: 'completed' },
            error: null,
        })

        const result = await discardSample({
            sampleId: TEST_SAMPLE_ID,
            reason: 'Should not discard completed',
        })

        expect(result).toEqual({
            error: 'Cannot discard samples with status "completed". Only received, assigned, in_progress, or review samples can be discarded.',
        })
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
})

describe('getRejectedSamplesCount', () => {
    const TEST_ANALYST_ID = 'c3333333-3333-4333-8333-333333333333'

    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAuthError.mockReturnValue(false)
        mockRequireRole.mockResolvedValue({ id: TEST_ANALYST_ID, role: 'analyst' })

        mockRejectedCountEqStatus.mockReturnValue({
            eq: mockRejectedCountEqReceivedBy,
        })
        mockRejectedCountEqReceivedBy.mockReturnValue({
            not: mockRejectedCountNotRejectedAt,
        })
        mockRejectedCountNotRejectedAt.mockReturnValue({
            is: mockRejectedCountIsDeleted,
        })
        mockRejectedCountIsDeleted.mockResolvedValue({
            count: 2,
            error: null,
        })

        mockSelect.mockImplementation((columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.count === 'exact' && options?.head) {
                return {
                    eq: mockRejectedCountEqStatus,
                }
            }

            return {
                eq: mockSelectEq,
            }
        })

        mockFrom.mockImplementation((table: string) => {
            if (table !== 'samples') {
                throw new Error(`Unexpected table: ${table}`)
            }
            return {
                select: mockSelect,
                update: mockUpdate,
            }
        })
    })

    it('returns the rejected sample count for the current analyst and excludes soft-deleted samples', async () => {
        const resultPromise = getRejectedSamplesCount()

        await expect(resultPromise).resolves.toEqual({ data: 2 })
        expect(mockRequireRole).toHaveBeenCalledWith('analyst')
        expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true })
        expect(mockRejectedCountEqStatus).toHaveBeenCalledWith('status', 'in_progress')
        expect(mockRejectedCountEqReceivedBy).toHaveBeenCalledWith('received_by', TEST_ANALYST_ID)
        expect(mockRejectedCountNotRejectedAt).toHaveBeenCalledWith('rejected_at', 'is', null)
        expect(mockRejectedCountIsDeleted).toHaveBeenCalledWith('deleted_at', null)
    })

    it('returns zero when no rejected samples exist', async () => {
        mockRejectedCountIsDeleted.mockResolvedValueOnce({
            count: 0,
            error: null,
        })

        await expect(getRejectedSamplesCount()).resolves.toEqual({ data: 0 })
    })

    it('preserves auth failures so the client-actions route can derive the correct status', async () => {
        mockRequireRole.mockResolvedValueOnce({ error: 'Unauthorized' })
        mockIsAuthError.mockReturnValueOnce(true)

        await expect(getRejectedSamplesCount()).resolves.toEqual({
            error: 'Unauthorized',
        })
        expect(mockSelect).not.toHaveBeenCalled()
    })
})

describe('approval confidentiality filtering', () => {
    const TEST_MANAGER_ID = 'd4444444-4444-4444-8444-444444444444'

    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAuthError.mockReturnValue(false)
        mockRequireRole.mockResolvedValue({ id: TEST_MANAGER_ID, role: 'manager' })

        mockUserEq.mockReturnValue({ single: mockUserSingle })
        mockSamplesEq.mockReturnValue({ is: mockSamplesDeleted })
        mockSamplesDeleted.mockReturnValue({ order: mockSamplesOrder })
        mockApprovalCountEqStatus.mockReturnValue({ is: mockApprovalCountDeleted })

        mockFrom.mockImplementation((table: string) => {
            if (table === 'users') {
                return {
                    select: () => ({
                        eq: mockUserEq,
                    }),
                }
            }

            if (table === 'samples') {
                return {
                    select: mockSelect,
                    update: mockUpdate,
                }
            }

            throw new Error(`Unexpected table: ${table}`)
        })

        mockAdminFrom.mockImplementation((table: string) => {
            if (table === 'results') {
                return {
                    select: () => ({
                        eq: mockConfidentialEqStatus,
                    }),
                }
            }

            throw new Error(`Unexpected table: ${table}`)
        })

        mockSelect.mockImplementation((_columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.count === 'exact' && options?.head) {
                return {
                    eq: mockApprovalCountEqStatus,
                }
            }

            return {
                eq: mockSamplesEq,
            }
        })
    })

    it('hides confidential review samples from unauthorized managers without revealing hidden work', async () => {
        mockUserSingle.mockResolvedValueOnce({
            data: { can_access_confidential: false },
            error: null,
        })
        mockSamplesOrder.mockResolvedValueOnce({
            data: [
                {
                    id: 'sample-public',
                    sample_id: 'CDC-XN-0001',
                    client_name: 'Nguyen Van A',
                    status: 'review',
                    received_at: '2026-01-05T10:00:00Z',
                    updated_at: '2026-01-05T11:00:00Z',
                    received_by_user: { full_name: 'KTV A' },
                    results: [{ id: 'result-public', status: 'entered' }],
                    coa_reports: null,
                },
                {
                    id: 'sample-confidential',
                    sample_id: 'CDC-XN-0002',
                    client_name: 'Tran Thi B',
                    status: 'review',
                    received_at: '2026-01-06T10:00:00Z',
                    updated_at: '2026-01-06T11:00:00Z',
                    received_by_user: { full_name: 'KTV B' },
                    results: [{ id: 'result-confidential', status: 'entered' }],
                    coa_reports: null,
                },
            ],
            error: null,
        })
        mockConfidentialEqStatus.mockReturnValueOnce({
            is: mockConfidentialEqDeleted,
        })
        mockConfidentialEqDeleted.mockReturnValueOnce({
            in: mockConfidentialEqSample,
        })
        mockConfidentialEqSample.mockResolvedValueOnce({
            data: [{ sample_id: 'sample-confidential' }],
            error: null,
        })

        const result = await getSamplesWithTab('review')

        expect(result).toEqual({
            data: [
                expect.objectContaining({
                    id: 'sample-public',
                    sample_id: 'CDC-XN-0001',
                }),
            ],
        })
        expect(mockAdminFrom).toHaveBeenCalledWith('results')
    })

    it('returns only visible approval counts for managers without confidential authorization', async () => {
        mockUserSingle.mockResolvedValueOnce({
            data: { can_access_confidential: false },
            error: null,
        })
        mockSelect.mockReturnValueOnce({
            eq: mockApprovalCountEqStatus,
        })
        mockApprovalCountEqStatus.mockReturnValueOnce({
            is: mockApprovalCountDeleted,
        })
        mockApprovalCountDeleted.mockResolvedValueOnce({
            data: [{ id: 'sample-public' }, { id: 'sample-confidential' }],
            error: null,
        })
        mockConfidentialEqStatus.mockReturnValueOnce({
            is: mockConfidentialEqDeleted,
        })
        mockConfidentialEqDeleted.mockReturnValueOnce({
            in: mockConfidentialEqSample,
        })
        mockConfidentialEqSample.mockResolvedValueOnce({
            data: [{ sample_id: 'sample-confidential' }],
            error: null,
        })

        const result = await getSamplesForApprovalCount()

        expect(result).toEqual({ data: 1 })
    })

    it('preserves confidential approval visibility for authorized managers in review and completed tabs', async () => {
        mockUserSingle.mockResolvedValueOnce({
            data: { can_access_confidential: true },
            error: null,
        })
        mockSamplesOrder.mockResolvedValueOnce({
            data: [
                {
                    id: 'sample-confidential',
                    sample_id: 'CDC-XN-9001',
                    client_name: 'Le Thi C',
                    status: 'completed',
                    received_at: '2026-01-07T10:00:00Z',
                    updated_at: '2026-01-07T11:00:00Z',
                    received_by_user: { full_name: 'KTV C' },
                    results: [{ id: 'result-confidential', status: 'approved' }],
                    coa_reports: null,
                },
            ],
            error: null,
        })

        const result = await getSamplesWithTab('completed')

        expect(result).toEqual({
            data: [
                expect.objectContaining({
                    id: 'sample-confidential',
                    sample_id: 'CDC-XN-9001',
                    status: 'completed',
                }),
            ],
        })
        expect(mockAdminFrom).not.toHaveBeenCalled()
    })

    it('hides confidential completed samples from unauthorized managers', async () => {
        mockUserSingle.mockResolvedValueOnce({
            data: { can_access_confidential: false },
            error: null,
        })
        mockSamplesOrder.mockResolvedValueOnce({
            data: [
                {
                    id: 'sample-confidential',
                    sample_id: 'CDC-XN-9002',
                    client_name: 'Pham Thi D',
                    status: 'completed',
                    received_at: '2026-01-08T10:00:00Z',
                    updated_at: '2026-01-08T11:00:00Z',
                    received_by_user: { full_name: 'KTV D' },
                    results: [{ id: 'result-confidential', status: 'approved' }],
                    coa_reports: null,
                },
            ],
            error: null,
        })
        mockConfidentialEqStatus.mockReturnValueOnce({
            is: mockConfidentialEqDeleted,
        })
        mockConfidentialEqDeleted.mockReturnValueOnce({
            in: mockConfidentialEqSample,
        })
        mockConfidentialEqSample.mockResolvedValueOnce({
            data: [{ sample_id: 'sample-confidential' }],
            error: null,
        })

        const result = await getSamplesWithTab('completed')

        expect(result).toEqual({ data: [] })
    })
})

describe('authorized analyst workflow continuity', () => {
    const TEST_ANALYST_ID = 'e5555555-5555-4555-8555-555555555555'

    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAuthError.mockReturnValue(false)
        mockRequireRole.mockResolvedValue({ id: TEST_ANALYST_ID, role: 'analyst' })
        mockRpc.mockResolvedValue({ data: true, error: null })
    })

    it('preserves review submission for analysts with confidential workflow access', async () => {
        const result = await submitSampleForReview('confidential-sample-id')

        expect(result).toEqual({ success: true })
        expect(mockRequireRole).toHaveBeenCalledWith('analyst')
        expect(mockRpc).toHaveBeenCalledWith('submit_sample_for_review', {
            p_sample_id: 'confidential-sample-id',
        })
        expect(mockRevalidatePath).toHaveBeenCalledWith('/analyst/samples')
        expect(mockRevalidatePath).toHaveBeenCalledWith('/manager/samples')
        expect(mockRevalidatePath).toHaveBeenCalledWith('/samples')
    })
})
