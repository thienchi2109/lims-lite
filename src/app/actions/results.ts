'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    SaveBatchResultsSchema,
    type SaveBatchResults,
    type ResultWithAssay,
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
                    validation_rules,
                    method:methods(name)
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
            method_name: result.assay?.method?.name || null,
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
        revalidatePath('/dashboard/analyst/results/[sampleId]', 'page')
        revalidatePath('/dashboard/manager/results/[sampleId]', 'page')

        return { success: true, updatedCount: updates.length }
    } catch (error) {
        console.error('Error in saveBatchResults:', error)
        if (error instanceof Error && error.message.includes('parse')) {
            return { error: 'Invalid input data' }
        }
        return { error: error instanceof Error ? error.message : 'Failed to save results' }
    }
}
