'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    SaveBatchResultsSchema,
    type SaveBatchResults,
    type ResultWithAssay,
    ApproveResultsSchema,
    type ApproveResults,
    CancelApprovalSchema,
    type CancelApproval,
} from '@/types'
import { validateNumericValue, validateTextValue } from '@/lib/utils-lims'

/**
 * Gets all results for a specific sample with assay details
 */
export async function getResultsBySample(sampleId: string) {
    try {
        const supabase = await createClient()

        // Get current user
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Fetch results with joined data
        const { data: results, error } = await supabase
            .from('results')
            .select(
                `
                *,
                assay:assay_definitions!results_assay_id_fkey(
                    id,
                    name,
                    units,
                    validation_rules
                ),
                method:methods!results_method_id_fkey(
                    name
                ),
                sample:samples!results_sample_id_fkey(sample_id),
                entered_by_user:users!results_entered_by_fkey(full_name)
            `
            )
            .eq('sample_id', sampleId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching results:', error)
            return { error: error.message }
        }

        // Transform data to flatten nested objects
        const transformedResults: ResultWithAssay[] = results.map((result: any) => ({
            ...result,
            assay_name: result.assay?.name || 'Unknown',
            assay_units: result.assay?.units || null,
            method_name: result.method?.name || null,
            validation_rules: result.assay?.validation_rules || {},
            sample_id_display: result.sample?.sample_id || '',
            entered_by_name: result.entered_by_user?.full_name || null,
        }))

        return { data: transformedResults }
    } catch (error) {
        console.error('Error in getResultsBySample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch results' }
    }
}

/**
 * Validates a result value against its assay validation rules
 */
export async function validateResultValue(
    value: string,
    rules: Record<string, any>
): Promise<string | null> {
    // Determine if numeric or text based on rules
    if (rules.type === 'numeric' || rules.min !== undefined || rules.max !== undefined) {
        return validateNumericValue(value, rules)
    }

    return validateTextValue(value, rules)
}

/**
 * Saves a batch of result values transactionally
 */
export async function saveBatchResults(data: SaveBatchResults) {
    try {
        const supabase = await createClient()

        // Get current user
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Validate input
        const validatedData = SaveBatchResultsSchema.parse(data)

        // Fetch result records to validate permissions and get validation rules
        const resultIds = validatedData.results.map((r) => r.id)
        const { data: existingResults, error: fetchError } = await supabase
            .from('results')
            .select(
                `
                id,
                status,
                assay:assay_definitions!results_assay_id_fkey(
                    validation_rules
                )
            `
            )
            .in('id', resultIds)

        if (fetchError) {
            console.error('Error fetching results for validation:', fetchError)
            return { error: fetchError.message }
        }

        // Validate each result value against its assay rules
        const validationErrors: Array<{ id: string; error: string }> = []

        for (const resultInput of validatedData.results) {
            const existing = existingResults.find((r: any) => r.id === resultInput.id)
            if (!existing) {
                validationErrors.push({ id: resultInput.id, error: 'Result not found' })
                continue
            }

            // Check if result is approved (analysts cannot edit)
            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single()

            if (userData?.role !== 'manager' && existing.status === 'approved') {
                validationErrors.push({
                    id: resultInput.id,
                    error: 'Cannot edit approved results',
                })
                continue
            }

            // Validate value against assay rules
            const assayData = existing.assay as any
            const rules = assayData?.validation_rules || {}
            const validationError = await validateResultValue(resultInput.value, rules)
            if (validationError) {
                validationErrors.push({ id: resultInput.id, error: validationError })
            }
        }

        if (validationErrors.length > 0) {
            return { error: 'Validation failed', validationErrors }
        }

        // Perform batch update in transaction
        const updates = validatedData.results.map((resultInput) => {
            const existing = existingResults.find((r: any) => r.id === resultInput.id)
            return {
                id: resultInput.id,
                value: resultInput.value,
                status: existing?.status === 'pending' ? 'entered' : existing?.status,
                entered_by: user.id,
                entered_at: new Date().toISOString(),
            }
        })

        // Execute updates
        const updatePromises = updates.map((update) =>
            supabase.from('results').update(update).eq('id', update.id)
        )

        const updateResults = await Promise.all(updatePromises)

        // Check for errors
        const errors = updateResults.filter((result) => result.error)
        if (errors.length > 0) {
            console.error('Error updating results:', errors)
            return {
                error: 'Some updates failed',
                details: errors.map((e) => e.error?.message),
            }
        }

        // Revalidate paths
        revalidatePath('/analyst/results/[sampleId]', 'page')
        revalidatePath('/manager/results/[sampleId]', 'page')

        return { success: true, updatedCount: updates.length }
    } catch (error) {
        console.error('Error in saveBatchResults:', error)
        if (error instanceof Error && error.message.includes('parse')) {
            return { error: 'Invalid input data' }
        }
        return { error: error instanceof Error ? error.message : 'Failed to save results' }
    }
}

/**
 * Approves a batch of results (Manager only)
 * Phase 4: Approval workflow
 */
export async function approveResults(data: ApproveResults) {
    try {
        const supabase = await createClient()

        // Get current user
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

        // Validate input
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

        // Validate all results are in 'entered' status
        const invalidResults = results.filter((r: any) => r.status !== 'entered')
        if (invalidResults.length > 0) {
            return { error: 'Can only approve results with status "entered"' }
        }

        // Verify all results belong to the same sample
        const sampleIds = [...new Set(results.map((r: any) => r.sample_id))]
        if (sampleIds.length > 1) {
            return { error: 'All results must belong to the same sample' }
        }

        // Perform batch approval
        const updateData: any = {
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
        }

        // Add optional note if provided
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

        // Update sample status to 'review'
        if (sampleIds[0]) {
            await supabase
                .from('samples')
                .update({ status: 'review' })
                .eq('id', sampleIds[0])
        }

        // Revalidate paths
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
 * Phase 4: Approval workflow
 */
export async function cancelApproval(data: CancelApproval) {
    try {
        const supabase = await createClient()

        // Get current user
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

        // Validate input
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

        // Validate all results are approved
        const invalidResults = results.filter((r: any) => r.status !== 'approved')
        if (invalidResults.length > 0) {
            return { error: 'Can only cancel approval for approved results' }
        }

        // Verify all results belong to the same sample
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
                .update({ status: 'in_progress' })
                .eq('id', sampleIds[0])
        }

        // Revalidate paths
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
