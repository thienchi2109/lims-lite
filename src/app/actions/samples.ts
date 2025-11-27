'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    CreateSampleSchema,
    UpdateSampleSchema,
    AssignTestsSchema,
    SampleListParamsSchema,
    type CreateSample,
    type UpdateSample,
    type AssignTests,
    type SampleListParams,
} from '@/types'
import { generateSampleId, getTodayRange } from '@/lib/utils-lims'
import { fetchSamples } from '@/lib/data/samples'

/**
 * Creates a new sample with auto-generated sample ID
 */
export async function createSample(data: CreateSample) {
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
        const validatedData = CreateSampleSchema.parse(data)

        // Get today's date range
        const { startOfDay, endOfDay } = getTodayRange()

        // Count samples created today to generate sequence number
        const { count } = await supabase
            .from('samples')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)

        // Generate sample ID
        const sampleId = generateSampleId(count || 0)

        // Create sample
        const { data: sample, error } = await supabase
            .from('samples')
            .insert({
                sample_id: sampleId,
                client_name: validatedData.client_name,
                received_by: user.id,
                received_at: validatedData.received_at || new Date().toISOString(),
                status: 'received',
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating sample:', error)
            return { error: error.message }
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/analyst/accession')
        revalidatePath('/manager/samples')

        return { data: sample }
    } catch (error) {
        console.error('Error in createSample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to create sample' }
    }
}

/**
 * Updates an existing sample
 */
export async function updateSample(data: UpdateSample) {
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
        const validatedData = UpdateSampleSchema.parse(data)

        // Build update object (only include defined fields)
        const updateData: any = {}
        if (validatedData.sample_id !== undefined) updateData.sample_id = validatedData.sample_id
        if (validatedData.client_name !== undefined) updateData.client_name = validatedData.client_name
        if (validatedData.status !== undefined) updateData.status = validatedData.status

        // Update sample
        const { data: sample, error } = await supabase
            .from('samples')
            .update(updateData)
            .eq('id', validatedData.id)
            .select()
            .single()

        if (error) {
            console.error('Error updating sample:', error)
            return { error: error.message }
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/manager/samples')

        return { data: sample }
    } catch (error) {
        console.error('Error in updateSample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to update sample' }
    }
}

/**
 * Gets paginated list of samples with filtering
 */
export async function getSamples(params: SampleListParams) {
    try {
        return await fetchSamples(params)
    } catch (error) {
        console.error('Error in getSamples:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch samples' }
    }
}

/**
 * Assigns tests to a sample (Manager only)
 */
export async function assignTests(data: AssignTests) {
    try {
        const supabase = await createClient()

        // Get current user
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Check if user is a manager
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Only managers can assign tests' }
        }

        // Validate input
        const validatedData = AssignTestsSchema.parse(data)

        // Create result records for each assay
        const resultInserts = validatedData.assayIds.map((assayId) => ({
            sample_id: validatedData.sampleId,
            assay_id: assayId,
            status: 'pending',
        }))

        const { error: insertError } = await supabase.from('results').insert(resultInserts)

        if (insertError) {
            console.error('Error creating results:', insertError)
            return { error: insertError.message }
        }

        // Update sample status to 'assigned'
        const { error: updateError } = await supabase
            .from('samples')
            .update({ status: 'assigned' })
            .eq('id', validatedData.sampleId)

        if (updateError) {
            console.error('Error updating sample status:', updateError)
            return { error: updateError.message }
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/manager/samples')

        return { success: true }
    } catch (error) {
        console.error('Error in assignTests:', error)
        return { error: error instanceof Error ? error.message : 'Failed to assign tests' }
    }
}

/**
 * Gets all available assay definitions
 */
export async function getAssayDefinitions() {
    try {
        const supabase = await createClient()

        const { data: assays, error } = await supabase
            .from('assay_definitions')
            .select(
                `
                *,
                method_name:methods(name)
            `
            )
            .is('deleted_at', null)
            .order('name')

        if (error) {
            console.error('Error fetching assays:', error)
            return { error: error.message }
        }

        // Transform data to flatten method_name
        const transformedAssays = assays.map((assay: any) => ({
            ...assay,
            method_name: assay.method_name?.name || null,
        }))

        return { data: transformedAssays }
    } catch (error) {
        console.error('Error in getAssayDefinitions:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch assays' }
    }
}

/**
 * Gets assigned tests for a sample
 */
export async function getSampleTests(sampleId: string) {
    try {
        const supabase = await createClient()

        const { data: results, error } = await supabase
            .from('results')
            .select(
                `
                *,
                assay:assay_definitions(id, name, units)
            `
            )
            .eq('sample_id', sampleId)

        if (error) {
            console.error('Error fetching sample tests:', error)
            return { error: error.message }
        }

        return { data: results }
    } catch (error) {
        console.error('Error in getSampleTests:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch sample tests' }
    }
}

/**
 * Gets samples that have results awaiting approval (Phase 4)
 * Returns samples with status in_progress or review that have entered/approved results
 */
export async function getSamplesForApproval() {
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
            return { error: 'Only managers can view approval queue' }
        }

        // Fetch samples with their results status counts
        const { data: samples, error } = await supabase
            .from('samples')
            .select(
                `
                id,
                sample_id,
                client_name,
                status,
                received_at,
                received_by_user:users!samples_received_by_fkey(full_name)
            `
            )
            .in('status', ['assigned', 'in_progress', 'review'])
            .is('deleted_at', null)
            .order('received_at', { ascending: false })

        if (error) {
            console.error('Error fetching samples for approval:', error)
            return { error: error.message }
        }

        // For each sample, get result counts
        const samplesWithCounts = await Promise.all(
            samples.map(async (sample: any) => {
                const { data: results } = await supabase
                    .from('results')
                    .select('id, status')
                    .eq('sample_id', sample.id)

                const totalTests = results?.length || 0
                const pendingCount = results?.filter((r: any) => r.status === 'pending').length || 0
                const enteredCount = results?.filter((r: any) => r.status === 'entered').length || 0
                const approvedCount = results?.filter((r: any) => r.status === 'approved').length || 0

                return {
                    ...sample,
                    received_by_name: sample.received_by_user?.full_name || null,
                    total_tests: totalTests,
                    pending_count: pendingCount,
                    entered_count: enteredCount,
                    approved_count: approvedCount,
                    needs_approval: enteredCount > 0,
                }
            })
        )

        // Filter to only samples that have tests entered (awaiting approval)
        const samplesNeedingApproval = samplesWithCounts.filter((s) => s.needs_approval)

        return { data: samplesNeedingApproval }
    } catch (error) {
        console.error('Error in getSamplesForApproval:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch samples for approval' }
    }
}
