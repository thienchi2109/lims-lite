'use server'

/**
 * Sample Approvals - Manager workflow and approval operations
 * Functions: getSamplesWithTab, getSamplesForApprovalCount, submitSampleForReview, rejectSample, discardSample
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import { RejectSampleSchema, DiscardSampleSchema, type RejectSample, type DiscardSample, type SampleStatus, type CoAReportStatus } from '@/types'

type ApprovalTab = 'review' | 'completed'

interface RawSampleResult {
    id: string
    status: string
}

interface RawSample {
    id: string
    sample_id: string
    client_name: string | null
    status: SampleStatus
    received_at: string | null
    updated_at: string | null
    received_by_user: { full_name: string } | null
    results: RawSampleResult[]
    coa_reports: { status: CoAReportStatus }[] | null
}

/**
 * Transform raw samples with result counts
 */
function transformSamplesWithCounts(samples: RawSample[]) {
    return samples.map((sample) => {
        const results = sample.results || []
        return {
            id: sample.id,
            sample_id: sample.sample_id,
            client_name: sample.client_name,
            status: sample.status,
            received_at: sample.received_at,
            updated_at: sample.updated_at,
            received_by_name: sample.received_by_user?.full_name || null,
            total_tests: results.length,
            pending_count: results.filter((r) => r.status === 'pending').length,
            entered_count: results.filter((r) => r.status === 'entered').length,
            approved_count: results.filter((r) => r.status === 'approved').length,
            coa_reports: sample.coa_reports || null,
        }
    })
}

/**
 * Gets samples filtered by tab (Manager only)
 * Consolidates getSamplesForApproval into this single function
 * @param tab - 'review' for approval queue, 'completed' for finished samples
 */
export async function getSamplesWithTab(tab: ApprovalTab) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return { error: 'Only managers can view approval queue' }

        const supabase = await createClient()

        const { data: samples, error } = await supabase
            .from('samples')
            .select(`
                id,
                sample_id,
                client_name,
                status,
                received_at,
                updated_at,
                received_by_user:users!samples_received_by_fkey(full_name),
                results(id, status),
                coa_reports!left(status)
            `)
            .eq('status', tab)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('Error fetching samples with tab:', error)
            return { error: error.message }
        }

        return { data: transformSamplesWithCounts(samples as unknown as RawSample[]) }
    } catch (error) {
        console.error('Error in getSamplesWithTab:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch samples' }
    }
}

/**
 * Gets the count of samples awaiting manager approval (status='review')
 */
export async function getSamplesForApprovalCount() {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return { error: 'Only managers can view approval queue' }

        const supabase = await createClient()

        const { count, error } = await supabase
            .from('samples')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'review')
            .is('deleted_at', null)

        if (error) {
            console.error('Error counting samples for approval:', error)
            return { error: error.message }
        }

        return { data: count ?? 0 }
    } catch (error) {
        console.error('Error in getSamplesForApprovalCount:', error)
        return { error: error instanceof Error ? error.message : 'Failed to count samples for approval' }
    }
}

/**
 * Submits a sample for review (Analyst)
 * Changes status from 'in_progress' to 'review'
 */
export async function submitSampleForReview(sampleId: string) {
    try {
        const auth = await requireRole('analyst')
        if (isAuthError(auth)) return { error: 'Only analysts can submit samples for review' }

        const supabase = await createClient()

        const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_sample_for_review', {
            p_sample_id: sampleId,
        })

        if (rpcError) {
            console.error('Error in submit_sample_for_review RPC:', rpcError)
            return { error: rpcError.message }
        }

        if (!rpcResult) {
            return { error: 'Failed to submit sample for review' }
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')

        return { success: true }
    } catch (error) {
        console.error('Error in submitSampleForReview:', error)
        return { error: error instanceof Error ? error.message : 'Failed to submit sample' }
    }
}

/**
 * Rejects a sample under review (Manager only)
 * Reverts status: 'review' -> 'in_progress'
 */
export async function rejectSample(data: RejectSample) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return { error: 'Only managers can reject samples' }

        const supabase = await createClient()
        const validatedData = RejectSampleSchema.parse(data)

        const { data: sample } = await supabase
            .from('samples')
            .select('id, status')
            .eq('id', validatedData.sampleId)
            .single()

        if (!sample) return { error: 'Sample not found' }
        if (sample.status !== 'review') {
            return { error: 'Can only reject samples with status "review"' }
        }

        const { error: updateError } = await supabase
            .from('samples')
            .update({
                status: 'in_progress',
                rejection_reason: validatedData.reason,
                rejected_at: new Date().toISOString(),
                rejected_by: auth.id
            })
            .eq('id', validatedData.sampleId)

        if (updateError) return { error: updateError.message }

        revalidatePath('/manager/approvals')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')

        return { success: true }
    } catch (error) {
        console.error('Error in rejectSample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to reject sample' }
    }
}

/**
 * Discards a sample (Manager only)
 * Changes status to 'discarded' for received, assigned, or review samples
 */
export async function discardSample(data: DiscardSample) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return { error: 'Only managers can discard samples' }

        const supabase = await createClient()
        const validatedData = DiscardSampleSchema.parse(data)

        const { data: sample } = await supabase
            .from('samples')
            .select('id, status')
            .eq('id', validatedData.sampleId)
            .single()

        if (!sample) return { error: 'Sample not found' }

        const discardableStatuses = ['received', 'assigned', 'review']
        if (!discardableStatuses.includes(sample.status)) {
            return { error: `Cannot discard samples with status "${sample.status}". Only received, assigned, or review samples can be discarded.` }
        }

        const { error: updateError } = await supabase
            .from('samples')
            .update({
                status: 'discarded',
                rejection_reason: validatedData.reason,
                rejected_at: new Date().toISOString(),
                rejected_by: auth.id
            })
            .eq('id', validatedData.sampleId)

        if (updateError) return { error: updateError.message }

        revalidatePath('/manager/approvals')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')

        return { success: true }
    } catch (error) {
        console.error('Error in discardSample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to discard sample' }
    }
}
