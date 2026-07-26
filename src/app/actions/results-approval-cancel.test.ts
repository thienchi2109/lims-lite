/** Regression coverage for cancelApproval, which is unchanged by Phase P2. */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.hoisted(() => vi.fn())
const mockCreateAdminClient = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
    createClient: mockCreateClient,
    createAdminClient: mockCreateAdminClient,
}))

vi.mock('@/app/actions/coa', () => ({
    generateCoA: vi.fn(),
}))

vi.mock('@/lib/coa/report-provenance', () => ({
    queueCoAReportForGeneration: vi.fn(),
    failCoAReportGeneration: vi.fn(),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { cancelApproval } from '@/app/actions/results-approval'

const USER_ID = 'd4444444-4444-4444-8444-444444444444'
const SAMPLE_ID = 'c3333333-3333-4333-8333-333333333333'
const RESULT_ID = 'a1111111-1111-4111-8111-111111111111'

type CancelScenario = {
    results: Array<{ id: string; status: string; sample_id: string }>
    canAccessConfidential?: boolean
    confidentialSample?: boolean
}

function setupCancelScenario(scenario: CancelScenario) {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = []

    mockCreateClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: USER_ID } },
            }),
        },
        from: vi.fn((table: string) => {
            let operation: 'select' | 'update' | null = null
            let updatePayload: Record<string, unknown> = {}
            const chain: Record<string, ReturnType<typeof vi.fn>> = {}

            chain.select = vi.fn(() => {
                operation = 'select'
                return chain
            })
            chain.update = vi.fn((payload: Record<string, unknown>) => {
                operation = 'update'
                updatePayload = payload
                updates.push({ table, payload })
                return chain
            })
            chain.eq = vi.fn(() => {
                if (table === 'samples' && operation === 'update') {
                    return Promise.resolve({ data: updatePayload, error: null })
                }
                return chain
            })
            chain.single = vi.fn(() =>
                Promise.resolve({
                    data: {
                        role: 'manager',
                        can_access_confidential: scenario.canAccessConfidential ?? true,
                    },
                    error: null,
                })
            )
            chain.in = vi.fn(() => {
                if (operation === 'select') {
                    return Promise.resolve({ data: scenario.results, error: null })
                }
                return Promise.resolve({ error: null })
            })

            return chain
        }),
    })

    const adminChain: Record<string, ReturnType<typeof vi.fn>> = {}
    adminChain.select = vi.fn(() => adminChain)
    adminChain.in = vi.fn(() => adminChain)
    adminChain.eq = vi.fn(() =>
        Promise.resolve({
            data: scenario.confidentialSample ? [{ sample_id: SAMPLE_ID }] : [],
            error: null,
        })
    )
    mockCreateAdminClient.mockReturnValue({
        from: vi.fn(() => adminChain),
    })

    return updates
}

describe('cancelApproval unchanged behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects hidden result IDs before cancel approval work starts', async () => {
        const updates = setupCancelScenario({ results: [] })

        const result = await cancelApproval({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID],
            reason: 'Correction required',
        })

        expect(result).toEqual({
            error: 'Không thể hủy phê duyệt một hoặc nhiều kết quả đã chọn',
        })
        expect(updates).toHaveLength(0)
    })

    it('blocks canceling visible rows from a confidential sample', async () => {
        const updates = setupCancelScenario({
            results: [{ id: RESULT_ID, status: 'approved', sample_id: SAMPLE_ID }],
            canAccessConfidential: false,
            confidentialSample: true,
        })

        const result = await cancelApproval({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID],
            reason: 'Correction required',
        })

        expect(result).toEqual({
            error: 'Không có quyền hủy phê duyệt kết quả bảo mật',
        })
        expect(updates).toHaveLength(0)
    })

    it('clears rejection fields when reverting the sample to in_progress', async () => {
        const updates = setupCancelScenario({
            results: [{ id: RESULT_ID, status: 'approved', sample_id: SAMPLE_ID }],
        })

        const result = await cancelApproval({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID],
            reason: 'Correction required',
        })

        expect(result).toEqual({ success: true, canceledCount: 1 })
        expect(updates).toContainEqual({
            table: 'samples',
            payload: {
                status: 'in_progress',
                rejection_reason: null,
                rejected_at: null,
                rejected_by: null,
            },
        })
    })
})
