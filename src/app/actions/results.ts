'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    SaveBatchResultsSchema,
    type SaveBatchResults,
    type ResultWithAssay,
} from '@/types'
import {
    fetchResultsForValidation,
    checkSampleEditability,
    validateResultsBatch,
} from './results-validation'
import { getActiveQCSessionsForAssays } from './qc-operations'

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
                    lab_specialties (
                        name,
                        display_order
                    )
                ),
                method:methods!results_method_id_fkey(
                    name
                ),
                sample:samples!results_sample_id_fkey(sample_id, status),
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
            sample_status: result.sample?.status || null,
            entered_by_name: result.entered_by_user?.full_name || null,
            lab_specialty_name: result.assay?.lab_specialties?.name || null,
            lab_specialty_order: result.assay?.lab_specialties?.display_order ?? 9999,
        }))

        return { data: transformedResults }
    } catch (error) {
        console.error('Error in getResultsBySample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch results' }
    }
}

/**
 * Saves a batch of result values transactionally
 */
export async function saveBatchResults(data: SaveBatchResults) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        const validatedData = SaveBatchResultsSchema.parse(data)
        const resultIds = validatedData.results.map((r) => r.id)

        // Fetch and validate results using extracted helper
        const fetchResult = await fetchResultsForValidation(resultIds)
        if ('error' in fetchResult) {
            return { error: fetchResult.error }
        }
        const existingResults = fetchResult.data

        // Check sample editability
        const editError = await checkSampleEditability(existingResults)
        if (editError) {
            return { error: editError }
        }

        // Validate batch using extracted helper
        const validationErrors = await validateResultsBatch(
            validatedData.results,
            existingResults,
            user.id
        )

        if (validationErrors.length > 0) {
            return { error: 'Validation failed', validationErrors }
        }

        // Get active QC sessions using extracted helper
        const uniqueAssayIds = [...new Set(existingResults.map((r) => r.assay_id))]
        const qcSessionMap = await getActiveQCSessionsForAssays(uniqueAssayIds)

        // Perform batch update with qc_session_id linking
        const updates = validatedData.results.map((resultInput) => {
            const existing = existingResults.find((r) => r.id === resultInput.id)
            const assayId = existing?.assay_id as string
            return {
                id: resultInput.id,
                value: resultInput.value,
                status: existing?.status === 'pending' ? 'entered' : existing?.status,
                entered_by: user.id,
                entered_at: new Date().toISOString(),
                qc_session_id: qcSessionMap[assayId] ?? null,
            }
        })

        // Execute updates
        const updatePromises = updates.map((update) =>
            supabase.from('results').update(update).eq('id', update.id)
        )

        const updateResults = await Promise.all(updatePromises)

        const errors = updateResults.filter((result) => result.error)
        if (errors.length > 0) {
            console.error('Error updating results:', errors)
            return {
                error: 'Some updates failed',
                details: errors.map((e) => e.error?.message),
            }
        }

        // Update sample status from 'assigned' to 'in_progress'
        try {
            const sampleIds = [...new Set(existingResults.map((r) => r.sample_id))]

            const { data: samplesToUpdate } = await supabase
                .from('samples')
                .select('id, status')
                .in('id', sampleIds)
                .eq('status', 'assigned')

            if (samplesToUpdate && samplesToUpdate.length > 0) {
                const idsToUpdate = samplesToUpdate.map((s: any) => s.id)
                await supabase
                    .from('samples')
                    .update({ status: 'in_progress' })
                    .in('id', idsToUpdate)
            }
        } catch (statusError) {
            console.error('Error updating sample status:', statusError)
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')

        return { success: true, updatedCount: updates.length }
    } catch (error) {
        console.error('Error in saveBatchResults:', error)
        if (error instanceof Error && error.message.includes('parse')) {
            return { error: 'Invalid input data' }
        }
        return { error: error instanceof Error ? error.message : 'Failed to save results' }
    }
}
