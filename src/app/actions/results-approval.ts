'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    ApproveResultsSchema,
    type ApproveResults,
    CancelApprovalSchema,
    type CancelApproval,
} from '@/types'
import { generateCoA } from './coa'

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
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Only managers can approve results' }
        }

        const validatedData = ApproveResultsSchema.parse(data)

        // Fetch results to verify they exist and have status='entered'
        const { data: results, error: fetchError } = await supabase
            .from('results')
            .select('id, status, sample_id')
            .in('id', validatedData.resultIds)

        if (fetchError) {
            console.error('Error fetching results for approval:', fetchError)
            return { error: fetchError.message }
        }

        const invalidResults = results.filter((r: any) => r.status !== 'entered')
        if (invalidResults.length > 0) {
            return { error: 'Can only approve results with status "entered"' }
        }

        const sampleIds = [...new Set(results.map((r: any) => r.sample_id))]
        if (sampleIds.length > 1) {
            return { error: 'All results must belong to the same sample' }
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

        if (qcCheck && Array.isArray(qcCheck)) {
            const blockedResults = qcCheck.filter((r: any) => !r.can_approve)
            if (blockedResults.length > 0) {
                const reasons = blockedResults
                    .map((r: any) => r.blocking_reason)
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
        const updateData: any = {
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
            // The database trigger creates a 'pending' CoA record, this call generates the actual HTML
            if (newStatus === 'completed') {
                // Fire and forget - don't block the approval response
                // Errors are logged but don't fail the approval
                generateCoA(sampleIds[0]).catch((err) => {
                    console.error('Auto CoA generation failed for sample', sampleIds[0], err)
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
            .select('role')
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

        const invalidResults = results.filter((r: any) => r.status !== 'approved')
        if (invalidResults.length > 0) {
            return { error: 'Can only cancel approval for approved results' }
        }

        const sampleIds = [...new Set(results.map((r: any) => r.sample_id))]
        if (sampleIds.length > 1) {
            return { error: 'All results must belong to the same sample' }
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
