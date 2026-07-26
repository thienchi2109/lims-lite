/** Phase P0 baseline after the API OTP guard and before the atomic P1 path. */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.hoisted(() => vi.fn())
const mockCreateAdminClient = vi.hoisted(() => vi.fn())
const mockGenerateCoA = vi.hoisted(() => vi.fn())
const mockQueueCoAReportForGeneration = vi.hoisted(() => vi.fn())
const mockFailCoAReportGeneration = vi.hoisted(() => vi.fn())

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
    revalidatePath: vi.fn(),
}))

import { approveResults } from '@/app/actions/results-approval'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SAMPLE_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_SAMPLE_ID = '33333333-3333-4333-8333-333333333333'
const RESULT_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_RESULT_ID = '55555555-5555-4555-8555-555555555555'

type ResultRow = {
    id: string
    status: string
    sample_id: string
    assay?: { is_confidential: boolean } | null
}

type Scenario = {
    authenticated: boolean
    role: string
    canAccessConfidential: boolean
    results: ResultRow[]
    resultFetchError: string | null
    sampleStatus: string
    qcData: unknown
    qcError: string | null
    resultUpdateError: string | null
    remainingUnapproved: number
}

type CapturedUpdates = {
    results: Array<Record<string, unknown>>
    samples: Array<Record<string, unknown>>
}

function createScenario(overrides: Partial<Scenario> = {}): Scenario {
    return {
        authenticated: true,
        role: 'manager',
        canAccessConfidential: true,
        results: [{ id: RESULT_ID, status: 'entered', sample_id: SAMPLE_ID }],
        resultFetchError: null,
        sampleStatus: 'review',
        qcData: [{ can_approve: true, blocking_reason: null }],
        qcError: null,
        resultUpdateError: null,
        remainingUnapproved: 1,
        ...overrides,
    }
}

function createSupabaseClient(scenario: Scenario, updates: CapturedUpdates) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: {
                    user: scenario.authenticated ? { id: USER_ID } : null,
                },
            }),
        },
        rpc: vi.fn().mockResolvedValue({
            data: scenario.qcData,
            error: scenario.qcError ? { message: scenario.qcError } : null,
        }),
        from: vi.fn((table: string) => {
            let operation: 'select' | 'update' | null = null
            let updatePayload: Record<string, unknown> | null = null
            const chain: Record<string, ReturnType<typeof vi.fn>> = {}

            chain.select = vi.fn(() => {
                operation = 'select'
                return chain
            })
            chain.update = vi.fn((payload: Record<string, unknown>) => {
                operation = 'update'
                updatePayload = payload
                updates[table as keyof CapturedUpdates]?.push(payload)
                return chain
            })
            chain.in = vi.fn(() => {
                if (table === 'results' && operation === 'select') {
                    return Promise.resolve({
                        data: scenario.results,
                        error: scenario.resultFetchError
                            ? { message: scenario.resultFetchError }
                            : null,
                    })
                }
                if (table === 'results' && operation === 'update') {
                    return Promise.resolve({
                        error: scenario.resultUpdateError
                            ? { message: scenario.resultUpdateError }
                            : null,
                    })
                }
                return chain
            })
            chain.eq = vi.fn(() => {
                if (table === 'samples' && operation === 'update') {
                    return Promise.resolve({ data: updatePayload, error: null })
                }
                return chain
            })
            chain.single = vi.fn(() => {
                if (table === 'users') {
                    return Promise.resolve({
                        data: {
                            role: scenario.role,
                            can_access_confidential: scenario.canAccessConfidential,
                        },
                        error: null,
                    })
                }
                return Promise.resolve({
                    data: { status: scenario.sampleStatus },
                    error: null,
                })
            })
            chain.neq = vi.fn(() =>
                Promise.resolve({
                    count: scenario.remainingUnapproved,
                    error: null,
                })
            )

            return chain
        }),
    }
}

function createAdminClient() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    chain.select = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    chain.eq = vi.fn(() =>
        Promise.resolve({
            data: [],
            error: null,
        })
    )
    return { from: vi.fn(() => chain) }
}

async function runApproval(
    overrides: Partial<Scenario> = {},
    input: { sampleId: string; resultIds: string[]; note?: string } = {
        sampleId: SAMPLE_ID,
        resultIds: [RESULT_ID],
    }
) {
    const scenario = createScenario(overrides)
    const updates: CapturedUpdates = { results: [], samples: [] }
    mockCreateClient.mockResolvedValue(createSupabaseClient(scenario, updates))
    mockCreateAdminClient.mockReturnValue(createAdminClient())

    return {
        result: await approveResults(input),
        updates,
    }
}

describe('approveResults current behavior', () => {
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

    it('approves one entered result and keeps a partial sample in review', async () => {
        const { result, updates } = await runApproval()

        expect(result).toEqual({ success: true, approvedCount: 1 })
        expect(updates.results[0]).toEqual({
            status: 'approved',
            approved_by: USER_ID,
            approved_at: expect.any(String),
        })
        expect(updates.samples).toEqual([{ status: 'review' }])
        expect(mockQueueCoAReportForGeneration).not.toHaveBeenCalled()
    })
    it('preserves the optional note and returns before CoA rendering settles', async () => {
        mockGenerateCoA.mockReturnValue(new Promise(() => undefined))

        const { result, updates } = await runApproval(
            { remainingUnapproved: 0 },
            {
                sampleId: SAMPLE_ID,
                resultIds: [RESULT_ID],
                note: 'Đã đối chiếu hồ sơ',
            }
        )

        expect(result).toEqual({ success: true, approvedCount: 1 })
        expect(updates.results[0]).toMatchObject({
            approval_note: 'Đã đối chiếu hồ sơ',
        })
        expect(updates.samples).toEqual([
            {
                status: 'completed',
                rejection_reason: null,
                rejected_at: null,
                rejected_by: null,
            },
        ])
        expect(mockQueueCoAReportForGeneration).toHaveBeenCalledWith(SAMPLE_ID)
        expect(mockGenerateCoA).toHaveBeenCalledOnce()
    })
    it('rejects an unauthorized role without mutating results', async () => {
        const { result, updates } = await runApproval({ role: 'analyst' })

        expect(result).toEqual({ error: 'Only managers can approve results' })
        expect(updates.results).toHaveLength(0)
    })
    it('rejects a confidential result without current confidential access', async () => {
        const { result } = await runApproval({
            canAccessConfidential: false,
            results: [{
                id: RESULT_ID,
                status: 'entered',
                sample_id: SAMPLE_ID,
                assay: { is_confidential: true },
            }],
        })

        expect(result).toEqual({
            error: 'Không có quyền phê duyệt kết quả bảo mật',
        })
    })
    it('rejects results when the sample is no longer under review', async () => {
        const { result } = await runApproval({ sampleStatus: 'completed' })

        expect(result).toEqual({
            error: 'Can only approve results for samples under review',
        })
    })
    it('rejects a selected result that is no longer entered', async () => {
        const { result } = await runApproval({
            results: [{ id: RESULT_ID, status: 'approved', sample_id: SAMPLE_ID }],
        })

        expect(result).toEqual({
            error: 'Can only approve results with status "entered"',
        })
    })
    it('rejects missing selected result IDs', async () => {
        const { result } = await runApproval({ results: [] })

        expect(result).toEqual({
            error: 'Không thể phê duyệt một hoặc nhiều kết quả đã chọn',
        })
    })
    it('rejects result IDs spanning more than one sample', async () => {
        const { result } = await runApproval(
            {
                results: [
                    { id: RESULT_ID, status: 'entered', sample_id: SAMPLE_ID },
                    {
                        id: OTHER_RESULT_ID,
                        status: 'entered',
                        sample_id: OTHER_SAMPLE_ID,
                    },
                ],
                qcData: [
                    { can_approve: true, blocking_reason: null },
                    { can_approve: true, blocking_reason: null },
                ],
            },
            {
                sampleId: SAMPLE_ID,
                resultIds: [RESULT_ID, OTHER_RESULT_ID],
            }
        )

        expect(result).toEqual({
            error: 'All results must belong to the same sample',
        })
    })
    it('records that the current action derives the sample from result IDs', async () => {
        const { result } = await runApproval(
            { results: [{ id: RESULT_ID, status: 'entered', sample_id: OTHER_SAMPLE_ID }] },
            { sampleId: SAMPLE_ID, resultIds: [RESULT_ID] }
        )

        expect(result).toEqual({ success: true, approvedCount: 1 })
    })
    it('fails closed when QC blocks approval', async () => {
        const { result } = await runApproval({
            qcData: [{ can_approve: false, blocking_reason: 'Westgard 1-3s' }],
        })

        expect(result).toEqual({
            error: 'Không thể phê duyệt: QC bị chặn. Westgard 1-3s',
            qc_blocked: true,
            blocked_count: 1,
        })
    })
    it('fails closed when the QC response is malformed', async () => {
        const { result } = await runApproval({ qcData: { can_approve: true } })

        expect(result).toEqual({
            error: 'Không thể phê duyệt: QC bị chặn. Phản hồi kiểm tra QC không hợp lệ.',
            qc_blocked: true,
            blocked_count: 1,
        })
    })
    it('returns a database update failure without completing the sample', async () => {
        const { result, updates } = await runApproval({
            resultUpdateError: 'database unavailable',
        })

        expect(result).toEqual({ error: 'database unavailable' })
        expect(updates.samples).toHaveLength(0)
        expect(mockQueueCoAReportForGeneration).not.toHaveBeenCalled()
    })
})
