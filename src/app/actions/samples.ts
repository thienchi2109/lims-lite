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
    type SampleWithUser,
} from '@/types'
import { generateSampleId, getTodayRange } from '@/lib/utils-lims'

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

        revalidatePath('/dashboard/analyst/samples')
        revalidatePath('/dashboard/analyst/accession')
        revalidatePath('/dashboard/manager/samples')

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

        revalidatePath('/dashboard/analyst/samples')
        revalidatePath('/dashboard/manager/samples')

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
        const supabase = await createClient()

        // Get current user
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Validate params
        const validatedParams = SampleListParamsSchema.parse(params)

        // Build query
        let query = supabase
            .from('samples')
            .select(
                `
                *,
                received_by_name:users!samples_received_by_fkey(full_name)
            `,
                { count: 'exact' }
            )
            .is('deleted_at', null)

        // Apply status filter
        if (validatedParams.status) {
            query = query.eq('status', validatedParams.status)
        }

        // Apply search filter
        if (validatedParams.search) {
            query = query.or(
                `sample_id.ilike.%${validatedParams.search}%,client_name.ilike.%${validatedParams.search}%`
            )
        }

        // Apply sorting
        const sortBy = validatedParams.sortBy || 'created_at'
        const sortOrder = validatedParams.sortOrder || 'desc'
        query = query.order(sortBy, { ascending: sortOrder === 'asc' })

        // Apply pagination
        const from = (validatedParams.page - 1) * validatedParams.pageSize
        const to = from + validatedParams.pageSize - 1
        query = query.range(from, to)

        const { data: samples, error, count } = await query

        if (error) {
            console.error('Error fetching samples:', error)
            return { error: error.message }
        }

        // Transform data to flatten received_by_name
        const transformedSamples: SampleWithUser[] = samples.map((sample: any) => ({
            ...sample,
            received_by_name: sample.received_by_name?.full_name || null,
        }))

        return {
            data: transformedSamples,
            count: count || 0,
            page: validatedParams.page,
            pageSize: validatedParams.pageSize,
            totalPages: Math.ceil((count || 0) / validatedParams.pageSize),
        }
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

        revalidatePath('/dashboard/analyst/samples')
        revalidatePath('/dashboard/manager/samples')

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
