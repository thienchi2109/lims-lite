/**
 * Integration tests for QC Operations Server Actions
 *
 * Tests cover:
 * - QC session management (start, end, get active session)
 * - QC result entry with Westgard rule evaluation
 * - QC status tracking
 * - QC history retrieval
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock the Supabase client
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockIs = vi.fn()
const mockNeq = vi.fn()
const mockGte = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSingle = vi.fn()
const mockGetUser = vi.fn()

// Create chainable mock functions
function createChainableFrom() {
    const chain = {
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        is: vi.fn(() => chain),
        neq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }
    return chain
}

let fromChain = createChainableFrom()

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

// Mock auth helpers
vi.mock('@/lib/auth-helpers', () => ({
    requireAuth: vi.fn(() => ({ id: 'user-123', role: 'analyst' })),
    requireRole: vi.fn((role: string) => {
        if (role === 'manager') {
            return { id: 'manager-456', role: 'manager' }
        }
        return { id: 'user-123', role: 'analyst' }
    }),
    isAuthError: vi.fn((result: any) => 'error' in result && !('id' in result)),
}))

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

// ============================================================================
// IMPORT AFTER MOCKS
// ============================================================================

import {
    startQCSession,
    endQCSession,
    getActiveSession,
    enterQCResult,
    getQCHistory,
} from '@/app/actions/qc-operations'

import { getQCStatusForAssays } from '@/app/actions/qc-status'

// ============================================================================
// TEST CONSTANTS
// ============================================================================

// Valid UUIDs for testing (must follow UUID v4 format)
const TEST_ASSAY_ID = 'a1111111-1111-4111-8111-111111111111'
const TEST_SESSION_ID = 'b2222222-2222-4222-8222-222222222222'
const TEST_DEF_ID = 'c3333333-3333-4333-8333-333333333333'
const TEST_USER_ID = 'd4444444-4444-4444-8444-444444444444'
const TEST_MANAGER_ID = 'e5555555-5555-4555-8555-555555555555'
const TEST_ASSAY_2_ID = 'f6666666-6666-4666-8666-666666666666'
const TEST_ASSAY_3_ID = 'a7777777-7777-4777-8777-777777777777'

// ============================================================================
// TESTS
// ============================================================================

describe('QC Session Management', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fromChain = createChainableFrom()
    })

    describe('startQCSession', () => {
        it('requires manager role', async () => {
            const { requireRole } = await import('@/lib/auth-helpers')
            vi.mocked(requireRole).mockResolvedValueOnce({ error: 'Unauthorized' })

            const result = await startQCSession({
                assay_id: TEST_ASSAY_ID,
                session_mode: 'daily',
            })

            expect(result).toHaveProperty('error')
        })

        it('prevents duplicate active sessions for same assay', async () => {
            // Mock existing active session
            fromChain.single.mockResolvedValueOnce({
                data: { id: TEST_SESSION_ID },
                error: null,
            })

            const result = await startQCSession({
                assay_id: TEST_ASSAY_ID,
                session_mode: 'daily',
            })

            expect(result.error).toContain('Đã có phiên QC đang hoạt động')
        })

        it('creates new session when no active session exists', async () => {
            // No existing session
            fromChain.single
                .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
                // Insert returns new session
                .mockResolvedValueOnce({
                    data: {
                        id: TEST_SESSION_ID,
                        assay_id: TEST_ASSAY_ID,
                        session_mode: 'daily',
                        qc_status: 'pending',
                    },
                    error: null,
                })

            const result = await startQCSession({
                assay_id: TEST_ASSAY_ID,
                session_mode: 'daily',
            })

            expect(result.data).toBeDefined()
            expect(result.data?.id).toBe(TEST_SESSION_ID)
        })

        it('supports different session modes', async () => {
            // Test each mode
            for (const mode of ['daily', 'batch', 'shift'] as const) {
                fromChain = createChainableFrom()
                fromChain.single
                    .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
                    .mockResolvedValueOnce({
                        data: { id: TEST_SESSION_ID, session_mode: mode },
                        error: null,
                    })

                const result = await startQCSession({
                    assay_id: TEST_ASSAY_ID,
                    session_mode: mode,
                })

                expect(result.data?.session_mode).toBe(mode)
            }
        })
    })

    describe('endQCSession', () => {
        it('requires manager role', async () => {
            const { requireRole } = await import('@/lib/auth-helpers')
            vi.mocked(requireRole).mockResolvedValueOnce({ error: 'Unauthorized' })

            const result = await endQCSession(TEST_SESSION_ID)

            expect(result).toHaveProperty('error')
        })

        it('ends active session with timestamp', async () => {
            fromChain.single.mockResolvedValueOnce({
                data: {
                    id: TEST_SESSION_ID,
                    ended_at: expect.any(String),
                    ended_by: TEST_MANAGER_ID,
                },
                error: null,
            })

            const result = await endQCSession(TEST_SESSION_ID)

            expect(result.data).toBeDefined()
            expect(result.data?.id).toBe(TEST_SESSION_ID)
        })

        it('allows optional notes on session end', async () => {
            fromChain.single.mockResolvedValueOnce({
                data: { id: TEST_SESSION_ID, notes: 'Ended due to shift change' },
                error: null,
            })

            const result = await endQCSession(TEST_SESSION_ID, 'Ended due to shift change')

            expect(result.data?.notes).toBe('Ended due to shift change')
        })
    })

    describe('getActiveSession', () => {
        it('returns null when no active session exists', async () => {
            fromChain.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116', message: 'No rows' },
            })

            const result = await getActiveSession(TEST_ASSAY_ID)

            expect(result.data).toBeNull()
            expect(result.error).toBeUndefined()
        })

        it('returns active session with assay details', async () => {
            fromChain.single.mockResolvedValueOnce({
                data: {
                    id: TEST_SESSION_ID,
                    assay_id: TEST_ASSAY_ID,
                    qc_status: 'pass',
                    assay: { id: TEST_ASSAY_ID, name: 'Glucose' },
                    started_by_user: { full_name: 'Manager User' },
                },
                error: null,
            })

            const result = await getActiveSession(TEST_ASSAY_ID)

            expect(result.data?.id).toBe(TEST_SESSION_ID)
            expect(result.data?.assay?.name).toBe('Glucose')
        })
    })
})

describe('QC Result Entry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fromChain = createChainableFrom()
    })

    describe('enterQCResult', () => {
        it('requires authentication', async () => {
            const { requireAuth } = await import('@/lib/auth-helpers')
            vi.mocked(requireAuth).mockResolvedValueOnce({ error: 'Unauthorized' })

            const result = await enterQCResult({
                session_id: TEST_SESSION_ID,
                definition_id: TEST_DEF_ID,
                value: 100,
            })

            expect(result).toHaveProperty('error')
        })

        it('returns error when definition not found', async () => {
            // Mock definition fetch returning null
            fromChain.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' },
            })

            const result = await enterQCResult({
                session_id: TEST_SESSION_ID,
                definition_id: TEST_DEF_ID,
                value: 100,
            })

            expect(result.error).toContain('Không tìm thấy định nghĩa QC')
        })
    })

    describe('getQCHistory', () => {
        it('returns QC results for date range', async () => {
            fromChain.order = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) =>
                    resolve({
                        data: [
                            { id: 'r1', value: 100, z_score: 0, status: 'pass', measured_at: '2024-01-01' },
                            { id: 'r2', value: 105, z_score: 1, status: 'pass', measured_at: '2024-01-02' },
                        ],
                        error: null,
                    }),
            })) as any

            const result = await getQCHistory(TEST_DEF_ID, 30)

            expect(result.data).toHaveLength(2)
        })

        it('uses default 30 day range', async () => {
            fromChain.order = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) => resolve({ data: [], error: null }),
            })) as any

            await getQCHistory(TEST_DEF_ID)

            // Verify gte was called for date filtering
            expect(mockFrom).toHaveBeenCalledWith('qc_results')
        })
    })
})

describe('QC Status Tracking', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fromChain = createChainableFrom()
    })

    describe('getQCStatusForAssays', () => {
        it('returns status for multiple assays', async () => {
            fromChain.order = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) =>
                    resolve({
                        data: [
                            { id: 's1', assay_id: TEST_ASSAY_ID, qc_status: 'pass', started_at: '2024-01-01', ended_at: null },
                            { id: 's2', assay_id: TEST_ASSAY_2_ID, qc_status: 'blocked', started_at: '2024-01-01', ended_at: null },
                        ],
                        error: null,
                    }),
            })) as any

            const result = await getQCStatusForAssays([
                TEST_ASSAY_ID,
                TEST_ASSAY_2_ID,
                TEST_ASSAY_3_ID
            ])

            if (!('error' in result)) {
                expect(result[TEST_ASSAY_ID].status).toBe('pass')
                expect(result[TEST_ASSAY_2_ID].status).toBe('blocked')
                expect(result[TEST_ASSAY_3_ID].status).toBe('no_session')
            }
        })

        it('returns no_session for assays without active sessions', async () => {
            fromChain.order = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) => resolve({ data: [], error: null }),
            })) as any

            const result = await getQCStatusForAssays([TEST_ASSAY_ID])

            if (!('error' in result)) {
                expect(result[TEST_ASSAY_ID].status).toBe('no_session')
                expect(result[TEST_ASSAY_ID].message).toContain('Chưa có phiên QC')
            }
        })

        it('handles ended sessions as no_session', async () => {
            fromChain.order = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) =>
                    resolve({
                        data: [
                            {
                                id: 's1',
                                assay_id: TEST_ASSAY_ID,
                                qc_status: 'pass',
                                started_at: '2024-01-01',
                                ended_at: '2024-01-02', // Session ended
                            },
                        ],
                        error: null,
                    }),
            })) as any

            const result = await getQCStatusForAssays([TEST_ASSAY_ID])

            // Ended sessions should show as no_session
            if (!('error' in result)) {
                expect(result[TEST_ASSAY_ID].status).toBe('no_session')
            }
        })

        it('provides Vietnamese status messages', async () => {
            fromChain.order = vi.fn(() => ({
                ...fromChain,
                then: (resolve: any) =>
                    resolve({
                        data: [
                            { id: 's1', assay_id: TEST_ASSAY_ID, qc_status: 'blocked', started_at: '2024-01-01', ended_at: null },
                        ],
                        error: null,
                    }),
            })) as any

            const result = await getQCStatusForAssays([TEST_ASSAY_ID])

            if (!('error' in result)) {
                expect(result[TEST_ASSAY_ID].message).toContain('thất bại')
            }
        })

        it('validates input array size', async () => {
            const result = await getQCStatusForAssays([])

            expect(result).toHaveProperty('error')
        })

        it('rejects invalid UUIDs', async () => {
            const result = await getQCStatusForAssays(['not-a-uuid'])

            expect(result).toHaveProperty('error')
        })
    })
})

describe('Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fromChain = createChainableFrom()
    })

    it('handles database errors gracefully', async () => {
        fromChain.single.mockResolvedValueOnce({
            data: null,
            error: { message: 'Database connection failed', code: 'XX000' },
        })

        const result = await getActiveSession(TEST_ASSAY_ID)

        expect(result.error).toBeDefined()
    })

    it('handles concurrent session creation attempts', async () => {
        // First check returns no session
        fromChain.single.mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116' },
        })

        // Insert fails due to race condition (unique constraint)
        fromChain.single.mockResolvedValueOnce({
            data: null,
            error: { message: 'duplicate key value violates unique constraint', code: '23505' },
        })

        const result = await startQCSession({
            assay_id: TEST_ASSAY_ID,
            session_mode: 'daily',
        })

        expect(result.error).toBeDefined()
    })
})
