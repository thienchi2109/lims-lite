/** Phase P2 characterization for the synchronous atomic single-approval path. */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.hoisted(() => vi.fn())
const mockCreateAdminClient = vi.hoisted(() => vi.fn())
const mockAdminRpc = vi.hoisted(() => vi.fn())
const mockGenerateCoA = vi.hoisted(() => vi.fn())
const mockQueueCoAReportForGeneration = vi.hoisted(() => vi.fn())
const mockFailCoAReportGeneration = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
    createClient: mockCreateClient,
    createAdminClient: mockCreateAdminClient,
}))

vi.mock('@/app/actions/coa', () => ({
    generateCoA: (...args: unknown[]) => mockGenerateCoA(...args),
}))

vi.mock('@/lib/coa/report-provenance', () => ({
    queueCoAReportForGeneration: (...args: unknown[]) =>
        mockQueueCoAReportForGeneration(...args),
    failCoAReportGeneration: (...args: unknown[]) =>
        mockFailCoAReportGeneration(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { approveResults } from '@/app/actions/results-approval'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SAMPLE_ID = '22222222-2222-4222-8222-222222222222'
const RESULT_ID = '44444444-4444-4444-8444-444444444444'

type AtomicOutcome = {
    success: boolean
    outcome_code: string
    approved_count?: number
    sample_completed?: boolean
    replayed?: boolean
    error_params?: {
        blocked_count?: number
    }
}

type ApprovalScenario = {
    authenticated?: boolean
    outcome?: AtomicOutcome | unknown
    rpcError?: string | null
    qcData?: unknown
    qcError?: string | null
}

async function runApproval(
    scenario: ApprovalScenario = {},
    input: { sampleId: string; resultIds: string[]; note?: string } = {
        sampleId: SAMPLE_ID,
        resultIds: [RESULT_ID],
    }
) {
    const userRpc = vi.fn().mockResolvedValue({
        data: scenario.qcData ?? [],
        error: scenario.qcError ? { message: scenario.qcError } : null,
    })
    const userFrom = vi.fn(() => {
        throw new Error('approveResults must not perform table queries before the atomic RPC')
    })
    const getUser = vi.fn().mockResolvedValue({
        data: {
            user: scenario.authenticated === false ? null : { id: USER_ID },
        },
    })

    mockCreateClient.mockResolvedValue({
        auth: { getUser },
        rpc: userRpc,
        from: userFrom,
    })
    mockAdminRpc.mockResolvedValue({
        data: scenario.outcome ?? {
            success: true,
            outcome_code: 'APPROVED',
            approved_count: input.resultIds.length,
            sample_completed: false,
            replayed: false,
        },
        error: scenario.rpcError ? { message: scenario.rpcError } : null,
    })
    mockCreateAdminClient.mockReturnValue({ rpc: mockAdminRpc })

    return {
        result: await approveResults(input),
        getUser,
        userRpc,
        userFrom,
    }
}

describe('approveResults atomic single-approval behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQueueCoAReportForGeneration.mockResolvedValue({
            reportId: '66666666-6666-4666-8666-666666666666',
            claimed: true,
            generationClaimId: '77777777-7777-4777-8777-777777777777',
        })
        mockGenerateCoA.mockResolvedValue({ success: true })
        mockFailCoAReportGeneration.mockResolvedValue(true)
    })

    it('uses one server-only atomic approval call and preserves the success contract', async () => {
        const { result, getUser, userFrom } = await runApproval()

        expect(result).toEqual({ success: true, approvedCount: 1 })
        expect(getUser).toHaveBeenCalledOnce()
        expect(userFrom).not.toHaveBeenCalled()
        expect(mockAdminRpc).toHaveBeenCalledOnce()
        expect(mockAdminRpc).toHaveBeenCalledWith('approve_sample_results_server', {
            p_manager_id: USER_ID,
            p_sample_id: SAMPLE_ID,
            p_result_ids: [RESULT_ID],
            p_approval_note: null,
        })
        expect(mockQueueCoAReportForGeneration).not.toHaveBeenCalled()
        expect(mockRevalidatePath.mock.calls).toEqual([
            ['/manager/approvals', 'page'],
            ['/manager/results/[sampleId]', 'page'],
            ['/manager/samples', 'page'],
        ])
    })

    it('preserves the optional note and returns before CoA rendering settles', async () => {
        mockGenerateCoA.mockReturnValue(new Promise(() => undefined))

        const { result } = await runApproval(
            {
                outcome: {
                    success: true,
                    outcome_code: 'APPROVED',
                    approved_count: 1,
                    sample_completed: true,
                    replayed: false,
                },
            },
            {
                sampleId: SAMPLE_ID,
                resultIds: [RESULT_ID],
                note: 'Đã đối chiếu hồ sơ',
            }
        )

        expect(result).toEqual({ success: true, approvedCount: 1 })
        expect(mockAdminRpc).toHaveBeenCalledWith('approve_sample_results_server', {
            p_manager_id: USER_ID,
            p_sample_id: SAMPLE_ID,
            p_result_ids: [RESULT_ID],
            p_approval_note: 'Đã đối chiếu hồ sơ',
        })
        expect(mockQueueCoAReportForGeneration).toHaveBeenCalledWith(SAMPLE_ID)
        expect(mockGenerateCoA).toHaveBeenCalledOnce()
    })

    it('accepts an idempotent already-approved outcome through the existing contract', async () => {
        const { result } = await runApproval({
            outcome: {
                success: true,
                outcome_code: 'ALREADY_APPROVED',
                approved_count: 1,
                sample_completed: false,
                replayed: true,
            },
        })

        expect(result).toEqual({ success: true, approvedCount: 1 })
        expect(mockQueueCoAReportForGeneration).not.toHaveBeenCalled()
        expect(mockRevalidatePath).toHaveBeenCalledTimes(3)
    })

    it('skips TypeScript CoA rendering when the queue claim is unavailable', async () => {
        mockQueueCoAReportForGeneration.mockResolvedValue(null)

        const { result } = await runApproval({
            outcome: {
                success: true,
                outcome_code: 'APPROVED',
                approved_count: 1,
                sample_completed: true,
                replayed: false,
            },
        })

        expect(result).toEqual({ success: true, approvedCount: 1 })
        expect(mockQueueCoAReportForGeneration).toHaveBeenCalledWith(SAMPLE_ID)
        expect(mockGenerateCoA).not.toHaveBeenCalled()
    })

    it('rejects an unauthenticated request before creating the service client', async () => {
        const { result } = await runApproval({ authenticated: false })

        expect(result).toEqual({ error: 'Unauthorized' })
        expect(mockCreateAdminClient).not.toHaveBeenCalled()
        expect(mockAdminRpc).not.toHaveBeenCalled()
    })

    it.each([
        ['MANAGER_REQUIRED', 'Only managers can approve results'],
        ['CONFIDENTIAL_ACCESS_REQUIRED', 'Không có quyền phê duyệt kết quả bảo mật'],
        ['SAMPLE_NOT_REVIEW', 'Can only approve results for samples under review'],
        ['RESULT_NOT_ENTERED', 'Can only approve results with status "entered"'],
        ['RESULT_NOT_FOUND', 'Không thể phê duyệt một hoặc nhiều kết quả đã chọn'],
        ['RESULT_SAMPLE_MISMATCH', 'All results must belong to the same sample'],
        ['REQUEST_CONFLICT', 'Invalid input data'],
        ['NOT_AUTHENTICATED', 'Unauthorized'],
    ])('maps %s to the existing client error contract', async (outcomeCode, error) => {
        const { result } = await runApproval({
            outcome: { success: false, outcome_code: outcomeCode },
        })

        expect(result).toEqual({ error })
        expect(mockQueueCoAReportForGeneration).not.toHaveBeenCalled()
        expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('preserves QC blocked details with a read-only reason lookup after rollback', async () => {
        const { result, userRpc } = await runApproval({
            outcome: {
                success: false,
                outcome_code: 'QC_BLOCKED',
                error_params: { blocked_count: 1 },
            },
            qcData: [{
                can_approve: false,
                blocking_reason: 'Westgard 1-3s',
            }],
        })

        expect(result).toEqual({
            error: 'Không thể phê duyệt: QC bị chặn. Westgard 1-3s',
            qc_blocked: true,
            blocked_count: 1,
        })
        expect(userRpc).toHaveBeenCalledWith('check_qc_approval_status', {
            p_result_ids: [RESULT_ID],
        })
        expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('fails closed when the atomic RPC reports malformed QC evidence', async () => {
        const { result, userRpc } = await runApproval({
            outcome: {
                success: false,
                outcome_code: 'QC_RESPONSE_INVALID',
            },
        })

        expect(result).toEqual({
            error: 'Không thể phê duyệt: QC bị chặn. Phản hồi kiểm tra QC không hợp lệ.',
            qc_blocked: true,
            blocked_count: 1,
        })
        expect(userRpc).not.toHaveBeenCalled()
    })

    it('returns an RPC transport failure without CoA handoff or revalidation', async () => {
        const { result } = await runApproval({ rpcError: 'database unavailable' })

        expect(result).toEqual({ error: 'database unavailable' })
        expect(mockQueueCoAReportForGeneration).not.toHaveBeenCalled()
        expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it.each([
        {
            success: true,
            outcome_code: 'APPROVED',
            approved_count: '1',
            sample_completed: false,
        },
        {
            success: false,
            outcome_code: 'toString',
        },
    ])('fails closed on an unknown or malformed atomic outcome', async (outcome) => {
        const { result } = await runApproval({ outcome })

        expect(result).toEqual({ error: 'Failed to approve results' })
        expect(mockQueueCoAReportForGeneration).not.toHaveBeenCalled()
        expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
})
