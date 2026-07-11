'use server'

import { createClient } from '@/lib/supabase/server'
import { firstRelation, type RelationValue } from '@/lib/supabase/relations'
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

type ResultAssayRelation = {
    name: string | null
    units: string | null
    normal_range: string | null
    method_name: string | null
    validation_rules: Record<string, unknown> | null
    updated_at: string
    lab_specialties: RelationValue<{
        name: string | null
        display_order: number | null
    }>
}

type ResultMethodRelation = {
    name: string | null
}

type ResultSampleRelation = {
    sample_id: string | null
    status: ResultWithAssay['sample_status']
    type: string | null
    received_at: string | null
    clients: RelationValue<{
        name: string | null
        date_of_birth: string | null
        gender: ResultWithAssay['client_gender']
        address: string | null
        health_insurance_num: string | null
    }>
}

type ResultUserRelation = {
    full_name: string | null
}

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
                    normal_range,
                    method_name,
                    validation_rules,
                    updated_at,
                    lab_specialties (
                        name,
                        display_order
                    )
                ),
                method:methods!results_method_id_fkey(
                    name
                ),
                sample:samples!results_sample_id_fkey(
                    sample_id,
                    status,
                    type,
                    received_at,
                    clients (
                        name,
                        date_of_birth,
                        gender,
                        address,
                        health_insurance_num
                    )
                ),
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
        const transformedResults: ResultWithAssay[] = results.map((result) => {
            const assay = firstRelation(result.assay as RelationValue<ResultAssayRelation>)
            const labSpecialty = firstRelation(assay?.lab_specialties)
            const method = firstRelation(result.method as RelationValue<ResultMethodRelation>)
            const sample = firstRelation(result.sample as RelationValue<ResultSampleRelation>)
            const client = firstRelation(sample?.clients)
            const enteredByUser = firstRelation(result.entered_by_user as RelationValue<ResultUserRelation>)

            return {
                ...result,
                assay_name: assay?.name || 'Unknown',
                assay_units: assay?.units || null,
                normal_range: assay?.normal_range || null,
                method_name: method?.name || assay?.method_name || null,
                validation_rules: assay?.validation_rules || {},
                assay_updated_at: assay?.updated_at || result.updated_at,
                sample_id_display: sample?.sample_id || '',
                sample_status: sample?.status || null,
                sample_type: sample?.type || null,
                received_date: sample?.received_at || null,
                client_name: client?.name || null,
                client_dob: client?.date_of_birth || null,
                client_gender: client?.gender || null,
                client_address: client?.address || null,
                client_health_insurance_num: client?.health_insurance_num || null,
                entered_by_name: enteredByUser?.full_name || null,
                lab_specialty_name: labSpecialty?.name || null,
                lab_specialty_order: labSpecialty?.display_order ?? 9999,
            }
        })

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
                const idsToUpdate = samplesToUpdate.map((sample) => sample.id)
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
