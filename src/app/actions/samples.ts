'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    CreateSampleSchema,
    CreateSampleWithAssignmentsSchema,
    UpdateSampleSchema,
    AssignTestsSchema,
    SampleListParamsSchema,
    type CreateSample,
    type CreateSampleWithAssignments,
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
 * Creates a sample and assigns tests in a single flow (analysts can assign for their own samples)
 */
export async function accessionAndAssignTests(data: CreateSampleWithAssignments) {
    try {
        const supabase = await createClient()

        // Ensure user is authenticated before calling RPC
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        const validatedData = CreateSampleWithAssignmentsSchema.parse(data)

        // Execute transactional accession + assignment via RPC (enforced by RLS)
        const { data: rpcResult, error } = await supabase.rpc('accession_and_assign_tests', {
            p_client_id: validatedData.client_id || null,
            p_client_name: validatedData.client_name,
            p_received_at: validatedData.received_at || null,
            p_tests: validatedData.tests,
        })

        if (error) {
            console.error('Error in accession_and_assign_tests RPC:', error)
            return { error: error.message }
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/analyst/accession')
        revalidatePath('/manager/samples')

        return { data: rpcResult }
    } catch (error) {
        console.error('Error in accessionAndAssignTests:', error)
        return { error: error instanceof Error ? error.message : 'Failed to accession sample' }
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
 * Gets a single sample by ID
 */
export async function getSample(id: string) {
    try {
        const supabase = await createClient()

        const { data: sample, error } = await supabase
            .from('samples')
            .select(
                `
                *,
                received_by_user:users!samples_received_by_fkey(full_name)
            `
            )
            .eq('id', id)
            .single()

        if (error) {
            console.error('Error fetching sample:', error)
            return { error: error.message }
        }

        return {
            data: {
                ...sample,
                received_by_name: sample.received_by_user?.full_name || null,
            },
        }
    } catch (error) {
        console.error('Error in getSample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch sample' }
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

        // Create result records for each test (assay + method combination)
        const resultInserts = validatedData.tests.map((test) => ({
            sample_id: validatedData.sampleId,
            assay_id: test.assayId,
            method_id: test.methodId,
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
 * Removes test assignments from a sample (Manager only)
 * Only allows removing tests that are still in 'pending' status
 */
export async function unassignTests(data: AssignTests) {
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
            return { error: 'Only managers can unassign tests' }
        }

        // Validate input
        const validatedData = AssignTestsSchema.parse(data)

        // Extract assay IDs from tests array
        const assayIds = validatedData.tests.map(t => t.assayId)

        // Delete result records for the specified assays
        // Only delete if status is 'pending' (not yet entered or approved)
        const { error: deleteError } = await supabase
            .from('results')
            .delete()
            .eq('sample_id', validatedData.sampleId)
            .in('assay_id', assayIds)
            .eq('status', 'pending')

        if (deleteError) {
            console.error('Error deleting results:', deleteError)
            return { error: deleteError.message }
        }

        // Check if sample still has any assigned tests
        const { count } = await supabase
            .from('results')
            .select('*', { count: 'exact', head: true })
            .eq('sample_id', validatedData.sampleId)

        // If no tests remain, update sample status back to 'received'
        if (count === 0) {
            await supabase
                .from('samples')
                .update({ status: 'received' })
                .eq('id', validatedData.sampleId)
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/manager/samples')

        return { success: true }
    } catch (error) {
        console.error('Error in unassignTests:', error)
        return { error: error instanceof Error ? error.message : 'Failed to unassign tests' }
    }
}

/**
 * Gets all available assay definitions with optional search
 */
export async function getAssayDefinitions(search?: string) {
    try {
        const supabase = await createClient()

        // 1. Fetch assay definitions
        let query = supabase
            .from('assay_definitions')
            .select('*')
            .is('deleted_at', null)
            .order('name')

        if (search) {
            query = query.ilike('name', `%${search}%`)
        }

        const { data: assays, error } = await query

        if (error) {
            console.error('Error fetching assays:', error)
            return { error: error.message }
        }

        if (!assays || assays.length === 0) {
            return { data: [] }
        }

        // 2. Fetch default methods for these assays
        const assayIds = assays.map(a => a.id)
        const { data: defaultMethods, error: methodsError } = await supabase
            .from('assay_methods')
            .select(`
                assay_id,
                method_id
            `)
            .in('assay_id', assayIds)
            .eq('is_default', true)

        if (methodsError) {
            console.error('Error fetching default methods:', methodsError)
        }

        // 2.5 Fetch methods details
        let methodsMap = new Map<string, any>()
        if (defaultMethods && defaultMethods.length > 0) {
            const methodIds = [...new Set(defaultMethods.map((am: any) => am.method_id))]
            const { data: methodsData, error: methodsDataError } = await supabase
                .from('methods')
                .select('id, name')
                .in('id', methodIds)

            if (methodsDataError) {
                console.error('Error fetching methods details:', methodsDataError)
            } else if (methodsData) {
                methodsData.forEach((m: any) => methodsMap.set(m.id, m))
            }
        }

        // 3. Merge data
        const transformedAssays = assays.map((assay: any) => {
            const defaultMethod = defaultMethods?.find((am: any) => am.assay_id === assay.id)
            const methodDetail = defaultMethod ? methodsMap.get(defaultMethod.method_id) : null

            return {
                ...assay,
                method_name: methodDetail?.name || null,
                default_method_id: defaultMethod?.method_id || null,
            }
        })

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
                assay:assay_definitions(
                    id, 
                    name, 
                    units
                ),
                method:methods(id, name)
            `
            )
            .eq('sample_id', sampleId)

        if (error) {
            console.error('Error fetching sample tests:', error)
            return { error: error.message }
        }

        // Transform to include method object with id and name
        const transformedResults = results.map((r: any) => ({
            ...r,
            assay: {
                ...r.assay,
                method: r.method ? { id: r.method.id, name: r.method.name } : null
            }
        }))

        return { data: transformedResults }
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

/**
 * Submits a sample for review (Analyst)
 * Changes status from 'in_progress' to 'review'
 * Requires all assigned tests to have values
 */
export async function submitSampleForReview(sampleId: string) {
    try {
        const supabase = await createClient()

        // Get current user
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // 1. Fetch sample and its results to validate
        const { data: sample, error: sampleError } = await supabase
            .from('samples')
            .select(`
                id,
                status,
                results (
                    id,
                    value,
                    status
                )
            `)
            .eq('id', sampleId)
            .single()

        if (sampleError) {
            console.error('Error fetching sample for submission:', sampleError)
            return { error: sampleError.message }
        }

        if (!sample) {
            return { error: 'Sample not found' }
        }

        // 2. Validate status
        if (sample.status !== 'in_progress') {
            return { error: 'Sample must be in progress to submit for review' }
        }

        // 3. Validate all results have values
        const results = sample.results || []
        if (results.length === 0) {
            return { error: 'Cannot submit sample with no assigned tests' }
        }

        const missingValues = results.filter((r: any) => r.value === null || r.value === '')
        if (missingValues.length > 0) {
            return { error: 'All tests must have results before submitting' }
        }

        // 4. Update sample status
        const { error: updateError } = await supabase
            .from('samples')
            .update({ status: 'review' })
            .eq('id', sampleId)

        if (updateError) {
            console.error('Error updating sample status:', updateError)
            return { error: updateError.message }
        }

        // 5. Revalidate paths
        revalidatePath('/analyst/samples')
        revalidatePath('/manager/samples')
        revalidatePath('/analyst/results/[sampleId]', 'page')

        return { success: true }
    } catch (error) {
        console.error('Error in submitSampleForReview:', error)
        return { error: error instanceof Error ? error.message : 'Failed to submit sample' }
    }
}
