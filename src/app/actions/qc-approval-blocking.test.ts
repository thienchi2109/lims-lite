/** Shared QC behavior for the atomic single-approval adapter. */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.hoisted(() => vi.fn())
const mockCreateAdminClient = vi.hoisted(() => vi.fn())
const mockAdminRpc = vi.hoisted(() => vi.fn())

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
    revalidatePath: vi.fn(),
}))

import { approveResults } from '@/app/actions/results-approval'

const USER_ID = 'd4444444-4444-4444-8444-444444444444'
const SAMPLE_ID = 'c3333333-3333-4333-8333-333333333333'
const RESULT_ID_1 = 'a1111111-1111-4111-8111-111111111111'
const RESULT_ID_2 = 'b2222222-2222-4222-8222-222222222222'

function setupAtomicOutcome(
    outcome: Record<string, unknown>,
    qcResponse: { data: unknown; error: { message: string } | null } = {
        data: [],
        error: null,
    }
) {
    const userRpc = vi.fn().mockResolvedValue(qcResponse)
    mockCreateClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: USER_ID } },
            }),
        },
        rpc: userRpc,
        from: vi.fn(),
    })
    mockAdminRpc.mockResolvedValue({ data: outcome, error: null })
    mockCreateAdminClient.mockReturnValue({ rpc: mockAdminRpc })
    return userRpc
}

describe('QC approval blocking mechanism', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps all blocking reasons and the server-derived blocked count', async () => {
        const userRpc = setupAtomicOutcome(
            {
                success: false,
                outcome_code: 'QC_BLOCKED',
                error_params: { blocked_count: 2 },
            },
            {
                data: [
                    { can_approve: false, blocking_reason: 'Lý do 1' },
                    { can_approve: false, blocking_reason: 'Lý do 2' },
                ],
                error: null,
            }
        )

        const result = await approveResults({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID_1, RESULT_ID_2],
        })

        expect(result).toEqual({
            error: 'Không thể phê duyệt: QC bị chặn. Lý do 1; Lý do 2',
            qc_blocked: true,
            blocked_count: 2,
        })
        expect(userRpc).toHaveBeenCalledOnce()
    })

    it('uses the existing generic reason when the read-only reason lookup fails', async () => {
        setupAtomicOutcome(
            {
                success: false,
                outcome_code: 'QC_BLOCKED',
                error_params: { blocked_count: 1 },
            },
            {
                data: null,
                error: { message: 'QC RPC unavailable' },
            }
        )

        const result = await approveResults({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID_1],
        })

        expect(result).toEqual({
            error: 'Không thể phê duyệt: QC bị chặn. Giải quyết vi phạm QC trước.',
            qc_blocked: true,
            blocked_count: 1,
        })
    })

    it('does not duplicate the QC query when the atomic command succeeds', async () => {
        const userRpc = setupAtomicOutcome({
            success: true,
            outcome_code: 'APPROVED',
            approved_count: 1,
            sample_completed: false,
            replayed: false,
        })

        const result = await approveResults({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID_1],
        })

        expect(result).toEqual({ success: true, approvedCount: 1 })
        expect(userRpc).not.toHaveBeenCalled()
        expect(mockAdminRpc).toHaveBeenCalledOnce()
    })

    it('fails closed on a malformed QC response outcome', async () => {
        const userRpc = setupAtomicOutcome({
            success: false,
            outcome_code: 'QC_RESPONSE_INVALID',
        })

        const result = await approveResults({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID_1, RESULT_ID_2],
        })

        expect(result).toEqual({
            error: 'Không thể phê duyệt: QC bị chặn. Phản hồi kiểm tra QC không hợp lệ.',
            qc_blocked: true,
            blocked_count: 2,
        })
        expect(userRpc).not.toHaveBeenCalled()
    })
})
