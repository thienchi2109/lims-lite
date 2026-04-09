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
import { firstRelation, type RelationValue } from '@/lib/supabase/relations'

type ResultAssayRelation = {
    is_confidential: boolean | null
}

type QCApprovalStatusRow = {
    can_approve: boolean
    blocking_reason: string | null
}

type ResultApprovalUpdate = {
    status: 'approved'
    approved_by: string
    approved_at: string
    approval_note?: string
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
 * Approves a batch of results (Manager only)
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

        // Verify user is manager
        const { data: userData } = await supabase
            .from('users')
            .select('role, can_access_confidential')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Only managers can approve results' }
        }

        const validatedData = ApproveResultsSchema.parse(data)

        // Fetch results to verify they exist and have status='entered'
        const { data: results, error: fetchError } = await supabase
            .from('results')
            .select(`
                id,
                status,
                sample_id,
                assay:assay_definitions!results_assay_id_fkey(
                    is_confidential
                )
            `)
            .in('id', validatedData.resultIds)

        if (fetchError) {
            console.error('Error fetching results for approval:', fetchError)
            return { error: fetchError.message }
        }

        if (results.length !== validatedData.resultIds.length) {
            return { error: 'Không thể phê duyệt một hoặc nhiều kết quả đã chọn' }
        }

        const invalidResults = results.filter((result) => result.status !== 'entered')
        if (invalidResults.length > 0) {
            return { error: 'Can only approve results with status "entered"' }
        }

        const includesConfidentialResult = results.some(
            (result) => firstRelation(result.assay as RelationValue<ResultAssayRelation>)?.is_confidential === true
        )
        if (includesConfidentialResult && userData?.can_access_confidential !== true) {
            return { error: 'Không có quyền phê duyệt kết quả bảo mật' }
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
            return { error: 'Không có quyền phê duyệt kết quả bảo mật' }
        }

        if (sampleIds[0]) {
            const { data: sample, error: sampleError } = await supabase
                .from('samples')
                .select('status')
                .eq('id', sampleIds[0])
                .single()

            if (sampleError) {
                console.error('Error fetching sample for approval:', sampleError)
                return { error: sampleError.message }
            }

            if (sample?.status !== 'review') {
                return { error: 'Can only approve results for samples under review' }
            }
        }

        // QC Session Check: Block approval if QC is blocked
        const { data: qcCheck } = await supabase.rpc('check_qc_approval_status', {
            p_result_ids: validatedData.resultIds,
        })

        if (qcCheck) {
            if (!Array.isArray(qcCheck)) {
                return createInvalidQCApprovalStatusResponse(1)
            }

            const qcStatusRows = qcCheck.filter(isQCApprovalStatusRow)
            if (qcStatusRows.length !== qcCheck.length) {
                return createInvalidQCApprovalStatusResponse(qcCheck.length)
            }

            const blockedResults = qcStatusRows.filter((result) => !result.can_approve)
            if (blockedResults.length > 0) {
                const reasons = blockedResults
                    .map((result) => result.blocking_reason)
                    .filter(Boolean)
                    .join('; ')
                return {
                    error: `Không thể phê duyệt: QC bị chặn. ${reasons || 'Giải quyết vi phạm QC trước.'}`,
                    qc_blocked: true,
                    blocked_count: blockedResults.length,
                }
            }
        }

        // Perform batch approval
        const updateData: ResultApprovalUpdate = {
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
        }

        if (validatedData.note) {
            updateData.approval_note = validatedData.note
        }

        const { error: updateError } = await supabase
            .from('results')
            .update(updateData)
            .in('id', validatedData.resultIds)

        if (updateError) {
            console.error('Error approving results:', updateError)
            return { error: updateError.message }
        }

        // Check if all results for this sample are now approved
        if (sampleIds[0]) {
            const { count } = await supabase
                .from('results')
                .select('id', { count: 'exact', head: true })
                .eq('sample_id', sampleIds[0])
                .neq('status', 'approved')

            const newStatus = count === 0 ? 'completed' : 'review'

            const sampleUpdateData: Record<string, unknown> = { status: newStatus }
            if (newStatus === 'completed') {
                sampleUpdateData.rejection_reason = null
                sampleUpdateData.rejected_at = null
                sampleUpdateData.rejected_by = null
            }

            await supabase
                .from('samples')
                .update(sampleUpdateData)
                .eq('id', sampleIds[0])

            // Auto-generate CoA when sample is completed (all results approved)
            // Fire-and-forget: don't block the approval response
            // Failures are recorded in coa_reports so Manager can see and retry
            if (newStatus === 'completed') {
                const completedSampleId = sampleIds[0]
                await markCoAGenerationPending(completedSampleId)
                void generateCoA(completedSampleId)
                    .then(async (result) => {
                        if (!result.success) {
                            if (!shouldRecordAutoCoAFailure(result)) {
                                return
                            }
                            console.error('Auto CoA generation failed for sample', completedSampleId, result.error)
                            await recordCoAFailure(completedSampleId, result.error)
                        }
                    })
                    .catch(async (err) => {
                        console.error('Auto CoA generation crashed for sample', completedSampleId, err)
                        await recordCoAFailure(
                            completedSampleId,
                            err instanceof Error ? err.message : 'Lỗi không xác định khi tạo CoA'
                        )
                    })
            }
        }

        revalidatePath('/manager/approvals', 'page')
        revalidatePath('/manager/results/[sampleId]', 'page')
        revalidatePath('/manager/samples', 'page')

        return { success: true, approvedCount: validatedData.resultIds.length }
    } catch (error) {
        console.error('Error in approveResults:', error)
        if (error instanceof Error && error.message.includes('parse')) {
            return { error: 'Invalid input data' }
        }
        return { error: error instanceof Error ? error.message : 'Failed to approve results' }
    }
}

/**
 * Records a CoA generation failure in coa_reports so the UI can surface it.
 * Creates a new 'failed' record or updates an existing one.
 */
async function recordCoAFailure(sampleId: string, errorMessage: string): Promise<void> {
    try {
        const supabase = await createClient()

        const { data: existing, error: fetchError } = await supabase
            .from('coa_reports')
            .select('id, status')
            .eq('sample_id', sampleId)
            .is('deleted_at', null)
            .maybeSingle()
        if (fetchError) {
            throw fetchError
        }

        if (existing) {
            if (existing.status === 'ready') {
                return
            }
            const { error: updateError } = await supabase
                .from('coa_reports')
                .update({ status: 'failed' as const, error_message: errorMessage })
                .eq('id', existing.id)
            if (updateError) {
                throw updateError
            }
        } else {
            const { error: insertError } = await supabase
                .from('coa_reports')
                .insert({
                    sample_id: sampleId,
                    file_path: '',
                    file_hash: '',
                    version: 1,
                    status: 'failed' as const,
                    error_message: errorMessage,
                })
            if (insertError) {
                throw insertError
            }
        }
    } catch (dbErr) {
        console.error('Failed to record CoA failure status for sample', sampleId, dbErr)
    }
}

/**
 * Avoid downgrading a valid ready CoA for business outcomes
 * (e.g. "already ready"). Only technical generation failures should be
 * persisted as failed.
 */
function shouldRecordAutoCoAFailure(
    result: Exclude<Awaited<ReturnType<typeof generateCoA>>, { success: true }>
): boolean {
    return result.shouldRecordFailure !== false && result.code !== 'ALREADY_READY'
}

/**
 * Persist a pending marker before background CoA generation starts.
 * This keeps manager UI observable even if background execution is interrupted.
 */
async function markCoAGenerationPending(sampleId: string): Promise<void> {
    try {
        const supabase = await createClient()
        const { data: existing, error: fetchError } = await supabase
            .from('coa_reports')
            .select('id, status')
            .eq('sample_id', sampleId)
            .is('deleted_at', null)
            .maybeSingle()
        if (fetchError) {
            throw fetchError
        }

        if (existing) {
            if (existing.status === 'ready') {
                return
            }

            const { error: updateError } = await supabase
                .from('coa_reports')
                .update({
                    status: 'pending' as const,
                    error_message: null,
                })
                .eq('id', existing.id)
            if (updateError) {
                throw updateError
            }
            return
        }

        const { error: insertError } = await supabase
            .from('coa_reports')
            .insert({
                sample_id: sampleId,
                file_path: '',
                file_hash: '',
                version: 1,
                status: 'pending' as const,
                error_message: null,
            })
        if (insertError) {
            throw insertError
        }
    } catch (dbErr) {
        console.error('Failed to mark CoA generation pending for sample', sampleId, dbErr)
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
