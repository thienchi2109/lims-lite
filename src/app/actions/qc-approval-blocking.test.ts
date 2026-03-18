/**
 * Integration tests for QC Approval Blocking Mechanism
 *
 * Tests cover:
 * - Approval blocking when QC session is blocked
 * - Approval blocking when QC session is pending
 * - Approval allowed when QC session is pass/resolved
 * - Approval allowed when qc_session_id is NULL (pre-QC era)
 * - Warning status handling
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

// Create chainable mock for different query scenarios
function createChainableMock() {
    const chain = {
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        neq: vi.fn(() => chain),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }
    return chain
}

let fromChain = createChainableMock()

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        rpc: mockRpc,
        from: (table: string) => {
            mockFrom(table)
            return fromChain
        },
        auth: {
            getUser: mockGetUser,
        },
    })),
}))

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

// ============================================================================
// IMPORT AFTER MOCKS
// ============================================================================

import { approveResults, cancelApproval } from '@/app/actions/results'

// ============================================================================
// TEST CONSTANTS
// ============================================================================

const TEST_RESULT_ID_1 = 'a1111111-1111-4111-8111-111111111111'
const TEST_RESULT_ID_2 = 'b2222222-2222-4222-8222-222222222222'
const TEST_SAMPLE_ID = 'c3333333-3333-4333-8333-333333333333'
const TEST_USER_ID = 'd4444444-4444-4444-8444-444444444444'
const TEST_SESSION_ID = 'e5555555-5555-4555-8555-555555555555'

// ============================================================================
// HELPER SETUP
// ============================================================================

function setupManagerAuth() {
    mockGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
    })

    // First query: check user role
    fromChain.single
        .mockResolvedValueOnce({
            data: { role: 'manager' },
            error: null,
        })
}

function setupResultsFetch(results: any[]) {
    setupInCallSequence([{ data: results, error: null }])
}

function setupInCallSequence(responses: any[]) {
    const inMock: any = vi.fn()
    for (const response of responses) {
        inMock.mockImplementationOnce(() => Promise.resolve(response))
    }

    inMock.mockImplementation(() => Promise.resolve({ data: null, error: null }))

    fromChain.in = inMock
}

function setupSampleStatusFetch(status: string) {
    fromChain.eq = vi.fn((_column: string, value: string) => {
        if (value === TEST_USER_ID) {
            return fromChain
        }

        if (value === TEST_SAMPLE_ID) {
            return {
                ...fromChain,
                single: vi.fn(() =>
                    Promise.resolve({
                        data: { status },
                        error: null,
                    })
                ),
            }
        }

        return fromChain
    }) as any
}

// ============================================================================
// TESTS
// ============================================================================

describe('QC Approval Blocking Mechanism', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fromChain = createChainableMock()
    })

    describe('Blocked QC Sessions', () => {
        it('blocks approval when QC session status is blocked', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])

            // Mock RPC check_qc_approval_status - returns blocked
            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: false,
                        qc_status: 'blocked',
                        blocking_reason: 'QC mất kiểm soát. Cần hành động khắc phục.',
                    },
                ],
                error: null,
            })

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            expect(result).toHaveProperty('error')
            expect(result.error).toContain('Không thể phê duyệt: QC bị chặn')
            expect((result as any).qc_blocked).toBe(true)
            expect((result as any).blocked_count).toBe(1)
        })

        it('blocks approval when QC session status is pending', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])

            // Mock RPC check_qc_approval_status - returns pending (QC not performed)
            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: false,
                        qc_status: 'pending',
                        blocking_reason: 'Chưa thực hiện QC cho phiên này',
                    },
                ],
                error: null,
            })

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            expect(result).toHaveProperty('error')
            expect(result.error).toContain('Không thể phê duyệt: QC bị chặn')
            expect((result as any).qc_blocked).toBe(true)
        })

        it('blocks approval for multiple results when any is blocked', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
                { id: TEST_RESULT_ID_2, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])

            // Mock RPC - one pass, one blocked
            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: true,
                        qc_status: 'pass',
                        blocking_reason: null,
                    },
                    {
                        result_id: TEST_RESULT_ID_2,
                        can_approve: false,
                        qc_status: 'blocked',
                        blocking_reason: 'QC mất kiểm soát. Cần hành động khắc phục.',
                    },
                ],
                error: null,
            })

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1, TEST_RESULT_ID_2],
            })

            expect(result).toHaveProperty('error')
            expect((result as any).qc_blocked).toBe(true)
            expect((result as any).blocked_count).toBe(1)
        })

        it('concatenates multiple blocking reasons', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
                { id: TEST_RESULT_ID_2, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])

            // Mock RPC - both blocked with different reasons
            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: false,
                        qc_status: 'blocked',
                        blocking_reason: 'Lý do 1',
                    },
                    {
                        result_id: TEST_RESULT_ID_2,
                        can_approve: false,
                        qc_status: 'pending',
                        blocking_reason: 'Lý do 2',
                    },
                ],
                error: null,
            })

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1, TEST_RESULT_ID_2],
            })

            expect(result.error).toContain('Lý do 1')
            expect(result.error).toContain('Lý do 2')
            expect((result as any).blocked_count).toBe(2)
        })
    })

    describe('Allowed QC Sessions', () => {
        it('rejects approval when sample is not under review and does not mutate state', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])
            setupSampleStatusFetch('in_progress')
            mockRpc.mockResolvedValueOnce({ data: [], error: null })
            fromChain.neq = vi.fn(() => ({
                then: (resolve: any) => resolve({ count: 0, error: null }),
            })) as any

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            expect(result).toEqual({
                error: 'Can only approve results for samples under review',
            })
            expect(mockRpc).not.toHaveBeenCalled()
            expect(fromChain.update).not.toHaveBeenCalled()
        })

        it('allows approval when QC session status is pass', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])
            setupSampleStatusFetch('review')

            // Mock RPC - QC passed
            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: true,
                        qc_status: 'pass',
                        blocking_reason: null,
                    },
                ],
                error: null,
            })

            // Mock the update
            setupInCallSequence([
                {
                    data: [{ id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID }],
                    error: null,
                },
                { error: null },
            ])

            // Mock count check for sample status update
            const mockCountResult = { count: 0, error: null }
            fromChain.neq = vi.fn(() => ({
                then: (resolve: any) => resolve(mockCountResult),
            })) as any

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            // Should not have qc_blocked error
            expect((result as any).qc_blocked).toBeUndefined()
        })

        it('allows approval when QC session status is resolved', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])
            setupSampleStatusFetch('review')

            // Mock RPC - QC resolved
            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: true,
                        qc_status: 'resolved',
                        blocking_reason: null,
                    },
                ],
                error: null,
            })

            // Mock the update
            setupInCallSequence([
                {
                    data: [{ id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID }],
                    error: null,
                },
                { error: null },
            ])

            // Mock count check
            fromChain.neq = vi.fn(() => ({
                then: (resolve: any) => resolve({ count: 0, error: null }),
            })) as any

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            expect((result as any).qc_blocked).toBeUndefined()
        })
    })

    describe('Pre-QC Era (NULL qc_session_id)', () => {
        it('allows approval when qc_session_id is NULL (pre-QC era)', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])
            setupSampleStatusFetch('review')

            // Mock RPC - NULL session = pre-QC era, allow approval
            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: true,
                        qc_status: 'pass', // Default when session is null
                        blocking_reason: null,
                    },
                ],
                error: null,
            })

            // Mock the update
            fromChain.in = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) => resolve({ error: null }),
            })) as any

            // Mock count check
            fromChain.neq = vi.fn(() => ({
                then: (resolve: any) => resolve({ count: 0, error: null }),
            })) as any

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            // Should succeed without QC blocking
            expect((result as any).qc_blocked).toBeUndefined()
        })

        it('allows mixed approval with NULL and pass sessions', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
                { id: TEST_RESULT_ID_2, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])
            setupSampleStatusFetch('review')

            // Mock RPC - one NULL (pre-QC), one pass
            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: true,
                        qc_status: 'pass', // NULL session defaults to pass
                        blocking_reason: null,
                    },
                    {
                        result_id: TEST_RESULT_ID_2,
                        can_approve: true,
                        qc_status: 'pass',
                        blocking_reason: null,
                    },
                ],
                error: null,
            })

            // Mock the update
            fromChain.in = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) => resolve({ error: null }),
            })) as any

            // Mock count check
            fromChain.neq = vi.fn(() => ({
                then: (resolve: any) => resolve({ count: 0, error: null }),
            })) as any

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1, TEST_RESULT_ID_2],
            })

            expect((result as any).qc_blocked).toBeUndefined()
        })
    })

    describe('RPC Error Handling', () => {
        it('handles RPC returning null gracefully', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])
            setupSampleStatusFetch('review')

            // Mock RPC returning null
            mockRpc.mockResolvedValueOnce({
                data: null,
                error: null,
            })

            // Mock the update
            fromChain.in = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) => resolve({ error: null }),
            })) as any

            // Mock count check
            fromChain.neq = vi.fn(() => ({
                then: (resolve: any) => resolve({ count: 0, error: null }),
            })) as any

            // Should not crash, just proceed
            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            // Should succeed since null RPC result doesn't block
            expect((result as any).qc_blocked).toBeUndefined()
        })

        it('handles RPC returning empty array gracefully', async () => {
            setupManagerAuth()
            setupResultsFetch([
                { id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID },
            ])
            setupSampleStatusFetch('review')

            // Mock RPC returning empty array
            mockRpc.mockResolvedValueOnce({
                data: [],
                error: null,
            })

            // Mock the update
            fromChain.in = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) => resolve({ error: null }),
            })) as any

            // Mock count check
            fromChain.neq = vi.fn(() => ({
                then: (resolve: any) => resolve({ count: 0, error: null }),
            })) as any

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            // Should succeed since empty array has no blockers
            expect((result as any).qc_blocked).toBeUndefined()
        })

        it('clears rejection fields when approval completes the sample', async () => {
            setupManagerAuth()
            setupSampleStatusFetch('review')

            mockRpc.mockResolvedValueOnce({
                data: [
                    {
                        result_id: TEST_RESULT_ID_1,
                        can_approve: true,
                        qc_status: 'pass',
                        blocking_reason: null,
                    },
                ],
                error: null,
            })

            setupInCallSequence([
                {
                    data: [{ id: TEST_RESULT_ID_1, status: 'entered', sample_id: TEST_SAMPLE_ID }],
                    error: null,
                },
                { error: null },
            ])

            fromChain.neq = vi.fn(() => ({
                then: (resolve: any) => resolve({ count: 0, error: null }),
            })) as any

            const result = await approveResults({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
            })

            expect(result).toHaveProperty('success', true)
            expect(fromChain.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'completed',
                    rejection_reason: null,
                    rejected_at: null,
                    rejected_by: null,
                })
            )
        })
    })

    describe('Cancel Approval', () => {
        it('clears rejection fields when reverting sample to in_progress', async () => {
            setupManagerAuth()
            setupInCallSequence([
                {
                    data: [{ id: TEST_RESULT_ID_1, status: 'approved', sample_id: TEST_SAMPLE_ID }],
                    error: null,
                },
                { error: null },
            ])

            const result = await cancelApproval({
                sampleId: TEST_SAMPLE_ID,
                resultIds: [TEST_RESULT_ID_1],
                reason: 'Correction required',
            })

            expect(result).toHaveProperty('success', true)
            expect(fromChain.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'in_progress',
                    rejection_reason: null,
                    rejected_at: null,
                    rejected_by: null,
                })
            )
        })
    })
})
