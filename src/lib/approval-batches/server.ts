import { getConfidentialAssociatedSampleIds } from '@/lib/data/confidential-samples'
import { createAdminClient } from '@/lib/supabase/server'
import {
    ApprovalSelectAllResponseSchema,
    type ApprovalBatchOutcomePage,
    type ApprovalBatchProgress,
    type ApprovalBatchSubmissionRequest,
    type ApprovalBatchSubmissionResponse,
    type ApprovalSelectAllResponse,
    type RetryApprovalBatchRequest,
} from '@/types'
import { getApprovalBatchManager } from './auth'
import {
    failure,
    mapApprovalBatchOutcomePage,
    mapApprovalBatchProgress,
    parseApprovalBatchMutationResult,
    type ApprovalBatchServerResult,
} from './server-results'

export type { ApprovalBatchServerResult } from './server-results'

const SELECT_ALL_PAGE_SIZE = 100

export async function getApprovalSelectAllSnapshot(
    request: Request,
): Promise<ApprovalBatchServerResult<ApprovalSelectAllResponse>> {
    const auth = await getApprovalBatchManager(request, {
        requireStepUp: false,
    })
    if (!auth.ok) return auth

    const sampleIds: string[] = []
    for (let from = 0; ; from += SELECT_ALL_PAGE_SIZE) {
        const { data, error } = await auth.manager.client
            .from('samples')
            .select('id')
            .eq('status', 'review')
            .is('deleted_at', null)
            .order('id')
            .range(from, from + SELECT_ALL_PAGE_SIZE - 1)

        if (error) {
            return failure(503, 'DATABASE_UNAVAILABLE')
        }

        const pageIds = (data ?? []).map((row: { id: string }) => row.id)
        sampleIds.push(...pageIds)
        if (pageIds.length < SELECT_ALL_PAGE_SIZE) break
    }

    let visibleSampleIds = sampleIds
    if (!auth.manager.canAccessConfidential && sampleIds.length > 0) {
        try {
            const confidential = await getConfidentialAssociatedSampleIds(
                sampleIds,
            )
            visibleSampleIds = sampleIds.filter(
                (sampleId) => !confidential.data.has(sampleId),
            )
        } catch {
            return failure(503, 'DATABASE_UNAVAILABLE')
        }
    }

    const parsed = ApprovalSelectAllResponseSchema.safeParse({
        sampleIds: visibleSampleIds,
        count: visibleSampleIds.length,
    })
    return parsed.success
        ? { ok: true, data: parsed.data }
        : failure(500, 'INTERNAL_ERROR')
}

export async function submitApprovalBatch(
    request: Request,
    input: ApprovalBatchSubmissionRequest,
): Promise<ApprovalBatchServerResult<ApprovalBatchSubmissionResponse>> {
    const auth = await getApprovalBatchManager(request, {
        requireStepUp: true,
    })
    if (!auth.ok) return auth
    if (!auth.manager.stepUp) {
        return failure(403, 'OTP_STEP_UP_REQUIRED')
    }

    const { data, error } = await createAdminClient().rpc(
        'create_approval_batch_server',
        {
            p_manager_id: auth.manager.id,
            p_request_key: input.requestKey,
            p_selection_mode: input.selectionMode,
            p_sample_ids: input.sampleIds,
            p_approval_note: input.note ?? null,
            p_step_up_authorization_id:
                auth.manager.stepUp.authorizationId,
            p_step_up_verified_at: auth.manager.stepUp.verifiedAt,
            p_step_up_cohort: auth.manager.stepUp.cohort,
        },
    )

    if (error) {
        return failure(503, 'DATABASE_UNAVAILABLE')
    }
    return parseApprovalBatchMutationResult(data, false)
}

export async function getApprovalBatchDetail(
    request: Request,
    batchId: string,
    pagination: { page: number; pageSize: number },
): Promise<
    ApprovalBatchServerResult<{
        progress: ApprovalBatchProgress
        outcomes: ApprovalBatchOutcomePage
    }>
> {
    const auth = await getApprovalBatchManager(request, {
        requireStepUp: false,
    })
    if (!auth.ok) return auth

    const offset = (pagination.page - 1) * pagination.pageSize
    const [progressResult, outcomesResult] = await Promise.all([
        auth.manager.client.rpc('get_approval_batch_progress', {
            p_batch_id: batchId,
        }),
        auth.manager.client.rpc('get_approval_batch_outcomes', {
            p_batch_id: batchId,
            p_limit: pagination.pageSize,
            p_offset: offset,
        }),
    ])

    if (progressResult.error || outcomesResult.error) {
        return failure(503, 'DATABASE_UNAVAILABLE')
    }
    if (!progressResult.data || !outcomesResult.data) {
        return failure(404, 'BATCH_NOT_FOUND')
    }

    const { data: batch, error: batchError } = await createAdminClient()
        .from('approval_batches')
        .select('updated_at')
        .eq('id', batchId)
        .single()

    if (batchError) {
        return failure(503, 'DATABASE_UNAVAILABLE')
    }
    if (!batch) {
        return failure(404, 'BATCH_NOT_FOUND')
    }

    const progress = mapApprovalBatchProgress(
        progressResult.data,
        batch.updated_at,
    )
    const outcomes = mapApprovalBatchOutcomePage(
        outcomesResult.data,
        pagination.page,
        pagination.pageSize,
    )
    if (!progress || !outcomes) {
        return failure(500, 'INTERNAL_ERROR')
    }

    return {
        ok: true,
        data: { progress, outcomes },
    }
}

export async function retryFailedApprovalBatch(
    request: Request,
    input: RetryApprovalBatchRequest,
): Promise<ApprovalBatchServerResult<ApprovalBatchSubmissionResponse>> {
    const auth = await getApprovalBatchManager(request, {
        requireStepUp: true,
    })
    if (!auth.ok) return auth
    if (!auth.manager.stepUp) {
        return failure(403, 'OTP_STEP_UP_REQUIRED')
    }

    const { data, error } = await createAdminClient().rpc(
        'retry_failed_approval_batch_server',
        {
            p_manager_id: auth.manager.id,
            p_parent_batch_id: input.parentBatchId,
            p_request_key: input.requestKey,
            p_step_up_authorization_id:
                auth.manager.stepUp.authorizationId,
            p_step_up_verified_at: auth.manager.stepUp.verifiedAt,
            p_step_up_cohort: auth.manager.stepUp.cohort,
        },
    )

    if (error) {
        return failure(503, 'DATABASE_UNAVAILABLE')
    }
    return parseApprovalBatchMutationResult(data, true)
}
