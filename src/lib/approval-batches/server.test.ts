import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createAdminClient: vi.fn(),
    getApprovalBatchManager: vi.fn(),
    getConfidentialAssociatedSampleIds: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args),
}))

vi.mock('@/lib/data/confidential-samples', () => ({
    getConfidentialAssociatedSampleIds: (...args: unknown[]) =>
        mocks.getConfidentialAssociatedSampleIds(...args),
}))

vi.mock('./auth', () => ({
    getApprovalBatchManager: (...args: unknown[]) =>
        mocks.getApprovalBatchManager(...args),
}))

import {
    getApprovalBatchDetail,
    getApprovalSelectAllSnapshot,
    retryFailedApprovalBatch,
    submitApprovalBatch,
} from './server'

const MANAGER_ID = '11111111-1111-4111-8111-111111111111'
const BATCH_ID = '22222222-2222-4222-8222-222222222222'
const REQUEST_KEY = '44444444-4444-4444-8444-444444444444'
const AUTHORIZATION_ID = '33333333-3333-4333-8333-333333333333'
const NOW = '2026-07-26T12:00:00.000Z'

function sampleId(index: number) {
    return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function createRequest() {
    return new Request('http://localhost/api/manager/approval-batches')
}

function createManagerContext(client: unknown) {
    return {
        ok: true,
        manager: {
            id: MANAGER_ID,
            canAccessConfidential: false,
            client,
            stepUp: {
                authorizationId: AUTHORIZATION_ID,
                verifiedAt: NOW,
                cohort: 'manager_email_otp',
            },
        },
    }
}

describe('approval batch server contracts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getConfidentialAssociatedSampleIds.mockResolvedValue({
            data: new Set<string>(),
        })
    })

    it('returns the full authorization-scoped selection snapshot across every page', async () => {
        const ids = Array.from({ length: 200 }, (_, index) => sampleId(index + 1))
        const samplesQuery = {
            select: vi.fn(() => samplesQuery),
            eq: vi.fn(() => samplesQuery),
            is: vi.fn(() => samplesQuery),
            order: vi.fn(() => samplesQuery),
            range: vi.fn(async (from: number, to: number) => ({
                data: ids
                    .slice(from, to + 1)
                    .map((id) => ({ id })),
                error: null,
            })),
        }
        const client = {
            from: vi.fn(() => samplesQuery),
        }
        mocks.getApprovalBatchManager.mockResolvedValue(
            createManagerContext(client),
        )
        mocks.getConfidentialAssociatedSampleIds.mockResolvedValue({
            data: new Set([ids[10], ids[150]]),
        })

        await expect(
            getApprovalSelectAllSnapshot(createRequest()),
        ).resolves.toEqual({
            ok: true,
            data: {
                sampleIds: ids.filter(
                    (id) => id !== ids[10] && id !== ids[150],
                ),
                count: 198,
            },
        })
        expect(samplesQuery.range).toHaveBeenNthCalledWith(1, 0, 99)
        expect(samplesQuery.range).toHaveBeenNthCalledWith(2, 100, 199)
        expect(samplesQuery.range).toHaveBeenNthCalledWith(3, 200, 299)
    })

    it.each([2, 200])(
        'submits %i samples through one all-or-nothing RPC-owned result snapshot',
        async (count) => {
            const rpc = vi.fn(async () => ({
                data: {
                    success: true,
                    outcome_code: 'BATCH_CREATED',
                    batch_id: BATCH_ID,
                    item_count: count,
                },
                error: null,
            }))
            mocks.createAdminClient.mockReturnValue({
                rpc,
                from: vi.fn(() => {
                    throw new Error(
                        'the RPC must snapshot entered results and exclude later additions',
                    )
                }),
            })
            mocks.getApprovalBatchManager.mockResolvedValue(
                createManagerContext({}),
            )
            const ids = Array.from(
                { length: count },
                (_, index) => sampleId(index + 1),
            )

            await expect(
                submitApprovalBatch(createRequest(), {
                    requestKey: REQUEST_KEY,
                    selectionMode: 'selected',
                    sampleIds: ids,
                    note: '  Ghi chú chung  ',
                }),
            ).resolves.toEqual({
                ok: true,
                data: { batchId: BATCH_ID },
            })
            expect(rpc).toHaveBeenCalledWith(
                'create_approval_batch_server',
                {
                    p_manager_id: MANAGER_ID,
                    p_request_key: REQUEST_KEY,
                    p_selection_mode: 'selected',
                    p_sample_ids: ids,
                    p_approval_note: '  Ghi chú chung  ',
                    p_step_up_authorization_id: AUTHORIZATION_ID,
                    p_step_up_verified_at: NOW,
                    p_step_up_cohort: 'manager_email_otp',
                },
            )
        },
    )

    it('returns the existing batch for a matching idempotency replay', async () => {
        mocks.createAdminClient.mockReturnValue({
            rpc: vi.fn(async () => ({
                data: {
                    success: true,
                    outcome_code: 'BATCH_REPLAYED',
                    batch_id: BATCH_ID,
                    item_count: 2,
                },
                error: null,
            })),
        })
        mocks.getApprovalBatchManager.mockResolvedValue(
            createManagerContext({}),
        )

        await expect(
            submitApprovalBatch(createRequest(), {
                requestKey: REQUEST_KEY,
                selectionMode: 'selected',
                sampleIds: [sampleId(1), sampleId(2)],
            }),
        ).resolves.toEqual({
            ok: true,
            data: { batchId: BATCH_ID },
        })
    })

    it.each([
        ['IDEMPOTENCY_CONFLICT', 409, 'REQUEST_CONFLICT'],
        ['SAMPLE_NOT_ELIGIBLE', 409, 'SAMPLE_NOT_REVIEW'],
        ['CONFIDENTIAL_ACCESS_REQUIRED', 404, 'BATCH_NOT_FOUND'],
    ])(
        'maps create outcome %s without leaking a partial batch',
        async (outcomeCode, status, errorCode) => {
            mocks.createAdminClient.mockReturnValue({
                rpc: vi.fn(async () => ({
                    data: {
                        success: false,
                        outcome_code: outcomeCode,
                    },
                    error: null,
                })),
            })
            mocks.getApprovalBatchManager.mockResolvedValue(
                createManagerContext({}),
            )

            await expect(
                submitApprovalBatch(createRequest(), {
                    requestKey: REQUEST_KEY,
                    selectionMode: 'selected',
                    sampleIds: [sampleId(1), sampleId(2)],
                }),
            ).resolves.toEqual({
                ok: false,
                status,
                error: { code: errorCode },
            })
        },
    )

    it('maps partial approval and a result no longer entered to paginated P0 outcomes', async () => {
        const rpc = vi.fn(async (name: string) => {
            if (name === 'get_approval_batch_progress') {
                return {
                    data: {
                        batch_id: BATCH_ID,
                        status: 'completed_with_failures',
                        created_at: NOW,
                        started_at: NOW,
                        completed_at: NOW,
                        total: 2,
                        queued: 0,
                        processing: 0,
                        retry_wait: 0,
                        succeeded: 1,
                        failed: 1,
                    },
                    error: null,
                }
            }

            return {
                data: {
                    batch_id: BATCH_ID,
                    total: 2,
                    limit: 1,
                    offset: 1,
                    items: [
                        {
                            item_id:
                                '55555555-5555-4555-8555-555555555555',
                            sample_id: sampleId(2),
                            status: 'failed',
                            attempt_count: 3,
                            terminal_error_code: 'RESULT_NOT_ENTERED',
                            error_params: {},
                            completed_at: NOW,
                        },
                    ],
                },
                error: null,
            }
        })
        const adminBatchQuery = {
            select: vi.fn(() => adminBatchQuery),
            eq: vi.fn(() => adminBatchQuery),
            single: vi.fn(async () => ({
                data: { updated_at: NOW },
                error: null,
            })),
        }
        const client = {
            rpc,
        }
        const adminFrom = vi.fn(() => adminBatchQuery)
        mocks.createAdminClient.mockReturnValue({ from: adminFrom })
        mocks.getApprovalBatchManager.mockResolvedValue(
            createManagerContext(client),
        )

        await expect(
            getApprovalBatchDetail(createRequest(), BATCH_ID, {
                page: 2,
                pageSize: 1,
            }),
        ).resolves.toEqual({
            ok: true,
            data: {
                progress: {
                    batchId: BATCH_ID,
                    status: 'completed_with_failures',
                    totalCount: 2,
                    queuedCount: 0,
                    processingCount: 0,
                    retryWaitCount: 0,
                    succeededCount: 1,
                    failedCount: 1,
                    createdAt: NOW,
                    startedAt: NOW,
                    completedAt: NOW,
                    updatedAt: NOW,
                },
                outcomes: {
                    batchId: BATCH_ID,
                    items: [
                        {
                            itemId:
                                '55555555-5555-4555-8555-555555555555',
                            sampleId: sampleId(2),
                            status: 'failed',
                            attemptCount: 3,
                            error: {
                                code: 'RESULT_NOT_ENTERED',
                            },
                            completedAt: NOW,
                        },
                    ],
                    page: 2,
                    pageSize: 1,
                    totalCount: 2,
                    totalPages: 2,
                },
            },
        })
        expect(adminFrom).toHaveBeenCalledWith('approval_batches')
        expect(rpc).toHaveBeenCalledWith(
            'get_approval_batch_outcomes',
            {
                p_batch_id: BATCH_ID,
                p_limit: 1,
                p_offset: 1,
            },
        )
    })

    it('conceals unauthorized or confidential batch reads as not found', async () => {
        const client = {
            rpc: vi.fn(async () => ({ data: null, error: null })),
            from: vi.fn(),
        }
        mocks.getApprovalBatchManager.mockResolvedValue(
            createManagerContext(client),
        )

        await expect(
            getApprovalBatchDetail(createRequest(), BATCH_ID, {
                page: 1,
                pageSize: 50,
            }),
        ).resolves.toEqual({
            ok: false,
            status: 404,
            error: { code: 'BATCH_NOT_FOUND' },
        })
    })

    it.each([
        ['BATCH_CREATED', true, 202, undefined],
        ['BATCH_REPLAYED', true, 202, undefined],
        ['NO_FAILED_ITEMS', false, 409, 'REQUEST_CONFLICT'],
        ['PARENT_BATCH_NOT_FOUND', false, 404, 'BATCH_NOT_FOUND'],
    ])(
        'maps failed-item retry outcome %s',
        async (outcomeCode, success, status, errorCode) => {
            const rpc = vi.fn(async () => ({
                data: success
                    ? {
                          success: true,
                          outcome_code: outcomeCode,
                          batch_id: BATCH_ID,
                          item_count: 1,
                      }
                    : {
                          success: false,
                          outcome_code: outcomeCode,
                      },
                error: null,
            }))
            mocks.createAdminClient.mockReturnValue({
                rpc,
            })
            mocks.getApprovalBatchManager.mockResolvedValue(
                createManagerContext({}),
            )

            const result = await retryFailedApprovalBatch(createRequest(), {
                parentBatchId: BATCH_ID,
                requestKey: REQUEST_KEY,
            })

            expect(result).toEqual(
                success
                    ? {
                          ok: true,
                          data: { batchId: BATCH_ID },
                      }
                    : {
                          ok: false,
                          status,
                          error: { code: errorCode },
                      },
            )
            expect(rpc).toHaveBeenCalledWith(
                'retry_failed_approval_batch_server',
                {
                    p_manager_id: MANAGER_ID,
                    p_parent_batch_id: BATCH_ID,
                    p_request_key: REQUEST_KEY,
                    p_step_up_authorization_id: AUTHORIZATION_ID,
                    p_step_up_verified_at: NOW,
                    p_step_up_cohort: 'manager_email_otp',
                },
            )
        },
    )
})
