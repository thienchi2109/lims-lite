'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    ApproveResultsSchema,
    type ApproveResults,
    CancelApprovalSchema,
    type CancelApproval,
} from '@/types'
import { generateCoA } from './coa'
import {
    failCoAReportGeneration,
    queueCoAReportForGeneration,
} from '@/lib/coa/report-provenance'

type QCApprovalStatusRow = {
    can_approve: boolean
    blocking_reason: string | null
}

const ATOMIC_APPROVAL_SUCCESS_CODES = new Set([
    'APPROVED',
    'ALREADY_APPROVED',
])

const ATOMIC_APPROVAL_FAILURE_MESSAGES = {
    NOT_AUTHENTICATED: 'Unauthorized',
    MANAGER_REQUIRED: 'Only managers can approve results',
    CONFIDENTIAL_ACCESS_REQUIRED: 'Không có quyền phê duyệt kết quả bảo mật',
    SAMPLE_NOT_REVIEW: 'Can only approve results for samples under review',
    RESULT_NOT_FOUND: 'Không thể phê duyệt một hoặc nhiều kết quả đã chọn',
    RESULT_NOT_ENTERED: 'Can only approve results with status "entered"',
    RESULT_SAMPLE_MISMATCH: 'All results must belong to the same sample',
    REQUEST_CONFLICT: 'Invalid input data',
} as const

type AtomicApprovalFailureCode =
    | keyof typeof ATOMIC_APPROVAL_FAILURE_MESSAGES
    | 'QC_BLOCKED'
    | 'QC_RESPONSE_INVALID'

type AtomicApprovalOutcome =
    | {
        success: true
        approvedCount: number
        sampleCompleted: boolean
    }
    | {
        success: false
        code: AtomicApprovalFailureCode
        blockedCount?: number
    }

function isQCApprovalStatusRow(value: unknown): value is QCApprovalStatusRow {
    if (!value || typeof value !== 'object') return false

    const row = value as Record<string, unknown>
    return typeof row.can_approve === 'boolean'
        && (typeof row.blocking_reason === 'string' || row.blocking_reason === null)
}

function createInvalidQCApprovalStatusResponse(rowCount: number) {
    return {
        error: 'Không thể phê duyệt: QC bị chặn. Phản hồi kiểm tra QC không hợp lệ.',
        qc_blocked: true,
        blocked_count: rowCount,
    }
}

function parseAtomicApprovalOutcome(value: unknown): AtomicApprovalOutcome | null {
    if (!value || typeof value !== 'object') return null

    const row = value as Record<string, unknown>
    if (typeof row.success !== 'boolean' || typeof row.outcome_code !== 'string') {
        return null
    }

    if (row.success) {
        const approvedCount = row.approved_count
        if (
            !ATOMIC_APPROVAL_SUCCESS_CODES.has(row.outcome_code)
            || !Number.isInteger(approvedCount)
            || (approvedCount as number) < 1
            || typeof row.sample_completed !== 'boolean'
        ) {
            return null
        }

        return {
            success: true,
            approvedCount: approvedCount as number,
            sampleCompleted: row.sample_completed,
        }
    }

    const failureCode = row.outcome_code as AtomicApprovalFailureCode
    if (
        !Object.prototype.hasOwnProperty.call(
            ATOMIC_APPROVAL_FAILURE_MESSAGES,
            failureCode,
        )
        && failureCode !== 'QC_BLOCKED'
        && failureCode !== 'QC_RESPONSE_INVALID'
    ) {
        return null
    }

    const errorParams = row.error_params
    const blockedCount = errorParams
        && typeof errorParams === 'object'
        && Number.isInteger((errorParams as Record<string, unknown>).blocked_count)
        && ((errorParams as Record<string, unknown>).blocked_count as number) > 0
        ? (errorParams as Record<string, unknown>).blocked_count as number
        : undefined

    return {
        success: false,
        code: failureCode,
        blockedCount,
    }
}

async function createQCBlockedResponse(
    supabase: Awaited<ReturnType<typeof createClient>>,
    resultIds: string[],
    blockedCount: number
) {
    const { data: qcCheck, error: qcCheckError } = await supabase.rpc(
        'check_qc_approval_status',
        { p_result_ids: resultIds }
    )

    if (qcCheckError) {
        console.error('Error reading QC blocking reasons after approval rollback:', qcCheckError)
    }

    const reasons = Array.isArray(qcCheck)
        ? qcCheck
            .filter(isQCApprovalStatusRow)
            .filter((result) => !result.can_approve)
            .map((result) => result.blocking_reason)
            .filter((reason): reason is string => Boolean(reason))
        : []

    return {
        error: `Không thể phê duyệt: QC bị chặn. ${reasons.join('; ') || 'Giải quyết vi phạm QC trước.'}`,
        qc_blocked: true,
        blocked_count: blockedCount,
    }
}

async function triggerCompletedSampleCoA(sampleId: string) {
    const report = await queueCoAReportForGeneration(sampleId)
    if (!report?.claimed || !report.generationClaimId) return

    const generationClaimId = report.generationClaimId
    void generateCoA(sampleId, undefined, report)
        .then((result) => {
            if (!result.success && result.shouldRecordFailure !== false) {
                console.error(
                    'Auto CoA generation failed for sample',
                    sampleId,
                    result.error,
                )
            }
        })
        .catch(async (error) => {
            console.error('Auto CoA generation crashed for sample', sampleId, error)
            await failCoAReportGeneration(
                report.reportId,
                generationClaimId,
                error instanceof Error ? error.message : 'Lỗi không xác định khi tạo CoA',
                false,
            )
        })
}

async function sampleHasConfidentialResults(sampleIds: string[]) {
    if (sampleIds.length === 0) {
        return { hasConfidential: false as const }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('results')
        .select(`
            sample_id,
            assay:assay_definitions!results_assay_id_fkey!inner(
                is_confidential
            )
        `)
        .in('sample_id', sampleIds)
        .eq('assay.is_confidential', true)

    if (error) {
        console.error('Error fetching confidential sample guard:', error)
        return { hasConfidential: false as const, error: error.message }
    }

    return {
        hasConfidential: (data ?? []).length > 0,
    }
}

/**
 * Approves selected results for one sample (Manager only).
 */
export async function approveResults(data: ApproveResults) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        const validatedData = ApproveResultsSchema.parse(data)
        const adminClient = createAdminClient()
        const { data: rawOutcome, error: approvalError } = await adminClient.rpc(
            'approve_sample_results_server',
            {
                p_manager_id: user.id,
                p_sample_id: validatedData.sampleId,
                p_result_ids: validatedData.resultIds,
                p_approval_note: validatedData.note ?? null,
            }
        )

        if (approvalError) {
            console.error('Error approving results atomically:', approvalError)
            return { error: approvalError.message }
        }

        const outcome = parseAtomicApprovalOutcome(rawOutcome)
        if (!outcome) {
            console.error('Atomic approval RPC returned an invalid outcome')
            return { error: 'Failed to approve results' }
        }

        if (!outcome.success) {
            if (outcome.code === 'QC_RESPONSE_INVALID') {
                return createInvalidQCApprovalStatusResponse(validatedData.resultIds.length)
            }
            if (outcome.code === 'QC_BLOCKED') {
                return createQCBlockedResponse(
                    supabase,
                    validatedData.resultIds,
                    outcome.blockedCount ?? validatedData.resultIds.length,
                )
            }

            return {
                error: ATOMIC_APPROVAL_FAILURE_MESSAGES[outcome.code],
            }
        }

        if (outcome.sampleCompleted) {
            await triggerCompletedSampleCoA(validatedData.sampleId)
        }

        revalidatePath('/manager/approvals', 'page')
        revalidatePath('/manager/results/[sampleId]', 'page')
        revalidatePath('/manager/samples', 'page')

        return { success: true, approvedCount: outcome.approvedCount }
    } catch (error) {
        console.error('Error in approveResults:', error)
        if (error instanceof Error && error.message.includes('parse')) {
            return { error: 'Invalid input data' }
        }
        return { error: error instanceof Error ? error.message : 'Failed to approve results' }
    }
}

/**
 * Cancels/revokes approval of results (Manager only)
 */
export async function cancelApproval(data: CancelApproval) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Verify user is manager
        const { data: userData } = await supabase
            .from('users')
            .select('role, can_access_confidential')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Only managers can cancel approvals' }
        }

        const validatedData = CancelApprovalSchema.parse(data)

        // Fetch results to verify they exist and are approved
        const { data: results, error: fetchError } = await supabase
            .from('results')
            .select('id, status, sample_id')
            .in('id', validatedData.resultIds)

        if (fetchError) {
            console.error('Error fetching results for cancel:', fetchError)
            return { error: fetchError.message }
        }

        if (results.length !== validatedData.resultIds.length) {
            return { error: 'Không thể hủy phê duyệt một hoặc nhiều kết quả đã chọn' }
        }

        const invalidResults = results.filter((result) => result.status !== 'approved')
        if (invalidResults.length > 0) {
            return { error: 'Can only cancel approval for approved results' }
        }

        const sampleIds = [...new Set(results.map((result) => result.sample_id))]
        if (sampleIds.length > 1) {
            return { error: 'All results must belong to the same sample' }
        }

        const confidentialSampleCheck = await sampleHasConfidentialResults(sampleIds)
        if (confidentialSampleCheck.error) {
            return { error: confidentialSampleCheck.error }
        }
        if (confidentialSampleCheck.hasConfidential && userData?.can_access_confidential !== true) {
            return { error: 'Không có quyền hủy phê duyệt kết quả bảo mật' }
        }

        // Cancel approval
        const { error: updateError } = await supabase
            .from('results')
            .update({
                status: 'entered',
                approved_by: null,
                approved_at: null,
                approval_note: `REVOKED: ${validatedData.reason}`,
            })
            .in('id', validatedData.resultIds)

        if (updateError) {
            console.error('Error canceling approval:', updateError)
            return { error: updateError.message }
        }

        // Update sample status back to 'in_progress'
        if (sampleIds[0]) {
            await supabase
                .from('samples')
                .update({
                    status: 'in_progress',
                    rejection_reason: null,
                    rejected_at: null,
                    rejected_by: null,
                })
                .eq('id', sampleIds[0])
        }

        revalidatePath('/manager/approvals', 'page')
        revalidatePath('/manager/results/[sampleId]', 'page')
        revalidatePath('/manager/samples', 'page')

        return { success: true, canceledCount: validatedData.resultIds.length }
    } catch (error) {
        console.error('Error in cancelApproval:', error)
        if (error instanceof Error && error.message.includes('parse')) {
            return { error: 'Invalid input data' }
        }
        return { error: error instanceof Error ? error.message : 'Failed to cancel approval' }
    }
}
