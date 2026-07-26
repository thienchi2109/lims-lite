/**
 * Validates database batch contract responses before they reach API routes.
 */

import {
    ApprovalBatchOutcomePageSchema,
    ApprovalBatchProgressSchema,
    ApprovalBatchSubmissionResponseSchema,
    ApprovalErrorCodeSchema,
    ApprovalErrorSchema,
    type ApprovalBatchOutcomePage,
    type ApprovalBatchProgress,
    type ApprovalBatchSubmissionResponse,
    type ApprovalError,
} from '@/types'

type ServerSuccess<T> = {
    ok: true
    data: T
}

type ServerFailure = {
    ok: false
    status: number
    error: ApprovalError
}

export type ApprovalBatchServerResult<T> = ServerSuccess<T> | ServerFailure

type RawMutationOutcome = {
    success: boolean
    outcome_code: string
    batch_id?: unknown
}

export function failure(
    status: number,
    code: ApprovalError['code'],
): ServerFailure {
    return {
        ok: false,
        status,
        error: { code },
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object'
}

function parseMutationOutcome(value: unknown): RawMutationOutcome | null {
    if (
        !isRecord(value)
        || typeof value.success !== 'boolean'
        || typeof value.outcome_code !== 'string'
    ) {
        return null
    }

    return {
        success: value.success,
        outcome_code: value.outcome_code,
        batch_id: value.batch_id,
    }
}

function mutationFailure(code: string, retry: boolean): ServerFailure {
    if (code === 'NOT_AUTHENTICATED') {
        return failure(401, 'NOT_AUTHENTICATED')
    }
    if (code === 'MANAGER_REQUIRED') {
        return failure(403, 'MANAGER_REQUIRED')
    }
    if (code === 'INVALID_STEP_UP_METADATA') {
        return failure(403, 'OTP_STEP_UP_REQUIRED')
    }
    if (code === 'CONFIDENTIAL_ACCESS_REQUIRED') {
        return failure(404, 'BATCH_NOT_FOUND')
    }
    if (code === 'IDEMPOTENCY_CONFLICT' || code === 'NO_FAILED_ITEMS') {
        return failure(409, 'REQUEST_CONFLICT')
    }
    if (code === 'SAMPLE_NOT_ELIGIBLE') {
        return failure(409, 'SAMPLE_NOT_REVIEW')
    }
    if (code === 'PARENT_BATCH_NOT_FOUND') {
        return failure(404, 'BATCH_NOT_FOUND')
    }
    if (code === 'INVALID_REQUEST') {
        return failure(400, retry ? 'BATCH_NOT_FOUND' : 'INTERNAL_ERROR')
    }

    return failure(500, 'INTERNAL_ERROR')
}

export function parseApprovalBatchMutationResult(
    rawOutcome: unknown,
    retry: boolean,
): ApprovalBatchServerResult<ApprovalBatchSubmissionResponse> {
    const outcome = parseMutationOutcome(rawOutcome)
    if (!outcome) {
        return failure(500, 'INTERNAL_ERROR')
    }
    if (!outcome.success) {
        return mutationFailure(outcome.outcome_code, retry)
    }
    if (
        outcome.outcome_code !== 'BATCH_CREATED'
        && outcome.outcome_code !== 'BATCH_REPLAYED'
    ) {
        return failure(500, 'INTERNAL_ERROR')
    }

    const parsed = ApprovalBatchSubmissionResponseSchema.safeParse({
        batchId: outcome.batch_id,
    })
    return parsed.success
        ? { ok: true, data: parsed.data }
        : failure(500, 'INTERNAL_ERROR')
}

export function mapApprovalBatchProgress(
    raw: unknown,
    updatedAt: unknown,
): ApprovalBatchProgress | null {
    if (!isRecord(raw)) return null

    const parsed = ApprovalBatchProgressSchema.safeParse({
        batchId: raw.batch_id,
        status: raw.status,
        totalCount: raw.total,
        queuedCount: raw.queued,
        processingCount: raw.processing,
        retryWaitCount: raw.retry_wait,
        succeededCount: raw.succeeded,
        failedCount: raw.failed,
        createdAt: raw.created_at,
        startedAt: raw.started_at,
        completedAt: raw.completed_at,
        updatedAt,
    })
    return parsed.success ? parsed.data : null
}

function mapOutcomeError(
    status: unknown,
    rawCode: unknown,
    rawParams: unknown,
): ApprovalError | null {
    if (status !== 'failed') return null

    const parsedCode = ApprovalErrorCodeSchema.safeParse(rawCode)
    const code = parsedCode.success ? parsedCode.data : 'INTERNAL_ERROR'
    const candidate = isRecord(rawParams) && Object.keys(rawParams).length > 0
        ? { code, params: rawParams }
        : { code }
    const parsed = ApprovalErrorSchema.safeParse(candidate)
    return parsed.success ? parsed.data : { code: 'INTERNAL_ERROR' }
}

export function mapApprovalBatchOutcomePage(
    raw: unknown,
    page: number,
    pageSize: number,
): ApprovalBatchOutcomePage | null {
    const expectedOffset = (page - 1) * pageSize
    if (
        !isRecord(raw)
        || !Array.isArray(raw.items)
        || typeof raw.total !== 'number'
        || raw.limit !== pageSize
        || raw.offset !== expectedOffset
    ) {
        return null
    }

    const items = raw.items.map((item) => {
        if (!isRecord(item)) return null

        return {
            itemId: item.item_id,
            sampleId: item.sample_id,
            status: item.status,
            attemptCount: item.attempt_count,
            error: mapOutcomeError(
                item.status,
                item.terminal_error_code,
                item.error_params,
            ),
            completedAt: item.completed_at,
        }
    })
    if (items.some((item) => item === null)) {
        return null
    }

    const parsed = ApprovalBatchOutcomePageSchema.safeParse({
        batchId: raw.batch_id,
        items,
        page,
        pageSize,
        totalCount: raw.total,
        totalPages: Math.ceil(raw.total / pageSize),
    })
    return parsed.success ? parsed.data : null
}
