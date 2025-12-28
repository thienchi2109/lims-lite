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
    RejectSampleSchema,
    DiscardSampleSchema,
    type RejectSample,
    type DiscardSample,
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

        // Use atomic RPC to prevent race conditions
        // create_sample_atomic returns the created sample object as JSONB
        const { data: sample, error } = await supabase.rpc('create_sample_atomic', {
            p_client_id: validatedData.client_id,
            p_client_name: validatedData.client_name || null,
            p_type: validatedData.type,
            p_received_at: validatedData.received_at || null,
            p_received_by: user.id,
        })

        if (error) {
            console.error('Error creating sample:', error)
            return { error: error.message }
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/analyst/accession')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')

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
            p_client_id: validatedData.client_id,
            p_client_name: validatedData.client_name,
            p_type: validatedData.type,
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
        revalidatePath('/samples')

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
        if (validatedData.client_id !== undefined) updateData.client_id = validatedData.client_id
        if (validatedData.client_name !== undefined) updateData.client_name = validatedData.client_name
        if (validatedData.type !== undefined) updateData.type = validatedData.type
        if (validatedData.status !== undefined) updateData.status = validatedData.status

        // Update sample
        const { data: sample, error } = await supabase
            .from('samples')
            .update(updateData)
            .eq('id', validatedData.id)
            .select()

        // Check if update was blocked by RLS or sample doesn't exist
        if (error) {
            console.error('Error updating sample:', error)
            return { error: error.message }
        }

        if (!sample || sample.length === 0) {
            return { error: 'Sample not found or you do not have permission to update it' }
        }

        revalidatePath('/analyst/samples')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')

        return { data: sample[0] }
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
                received_by_user:users!samples_received_by_fkey(full_name),
                rejected_by_user:users!samples_rejected_by_fkey(full_name),
                client:clients!samples_client_fk(
                    id,
                    name,
                    date_of_birth,
                    gender,
                    phone,
                    address,
                    health_insurance_num
                )
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
                rejected_by_name: sample.rejected_by_user?.full_name || null,
            },
        }
    } catch (error) {
        console.error('Error in getSample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch sample' }
    }
}

/**
 * Assigns tests to a sample
 * - Managers: Can assign at any status
 * - Analysts: Can only assign when status is 'received' or 'assigned'
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

        // Check user role
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!userData || !['analyst', 'manager'].includes(userData.role)) {
            return { error: 'Không có quyền chỉ định xét nghiệm' }
        }

        // Validate input
        const validatedData = AssignTestsSchema.parse(data)

        // Execute RPC to insert results + update sample status atomically
        const { data: rpcResult, error: rpcError } = await supabase.rpc('assign_tests_to_sample', {
            p_sample_id: validatedData.sampleId,
            p_tests: validatedData.tests,
        })

        if (rpcError) {
            console.error('Error in assign_tests_to_sample RPC:', rpcError)
            return { error: rpcError.message }
        }

        if (!rpcResult) {
            return { error: 'Không thể chỉ định xét nghiệm, vui lòng thử lại' }
        }

        if ((rpcResult.inserted_count ?? 0) > 0) {
            revalidatePath('/analyst/samples')
            revalidatePath('/manager/samples')
            revalidatePath('/samples')
        }

        return { success: true, data: rpcResult }
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
        revalidatePath('/samples')

        return { success: true }
    } catch (error) {
        console.error('Error in unassignTests:', error)
        return { error: error instanceof Error ? error.message : 'Failed to unassign tests' }
    }
}

/**
 * Gets all available assay definitions with optional search
 * Uses a single query with foreign key joins to avoid N+1 queries
 */
export async function getAssayDefinitions(search?: string) {
    try {
        const supabase = await createClient()

        // Single query with joins: assay_definitions -> assay_methods (default) -> methods
        let query = supabase
            .from('assay_definitions')
            .select(`
                *,
                assay_methods!left (
                    method_id,
                    is_default,
                    method:methods (
                        id,
                        name
                    )
                )
            `)
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

        // Transform data to extract default method info
        const transformedAssays = assays.map((assay) => {
            // Find the default method from the joined assay_methods
            const defaultMethodLink = assay.assay_methods?.find(
                (am: { is_default: boolean }) => am.is_default
            )
            const methodDetail = defaultMethodLink?.method as { id: string; name: string } | null

            // Remove assay_methods from the response, add flattened fields
            const { assay_methods, ...assayData } = assay
            return {
                ...assayData,
                method_name: methodDetail?.name || null,
                default_method_id: defaultMethodLink?.method_id || null,
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

        // Fetch only samples that analysts have explicitly submitted for review
        // Status 'review' means the analyst used submitSampleForReview()
        const { data: samples, error } = await supabase
            .from('samples')
            .select(
                `
                id,
                sample_id,
                client_name,
                status,
                received_at,
                updated_at,
                received_by_user:users!samples_received_by_fkey(full_name),
                results(id, status),
                coa_reports!left(status)
            `
            )
            .eq('status', 'review')
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('Error fetching samples for approval:', error)
            return { error: error.message }
        }

        // Transform data with result counts (computed from nested results, no additional queries)
        const samplesWithCounts = samples.map((sample) => {
            const results = sample.results || []
            const totalTests = results.length
            const pendingCount = results.filter((r) => r.status === 'pending').length
            const enteredCount = results.filter((r) => r.status === 'entered').length
            const approvedCount = results.filter((r) => r.status === 'approved').length

            return {
                id: sample.id,
                sample_id: sample.sample_id,
                client_name: sample.client_name,
                status: sample.status,
                received_at: sample.received_at,
                updated_at: sample.updated_at,
                received_by_name: (sample.received_by_user as unknown as { full_name: string } | null)?.full_name || null,
                total_tests: totalTests,
                pending_count: pendingCount,
                entered_count: enteredCount,
                approved_count: approvedCount,
                coa_reports: sample.coa_reports || null,
            }
        })

        // All samples in 'review' status should have entered results, return all for visibility
        return { data: samplesWithCounts }
    } catch (error) {
        console.error('Error in getSamplesForApproval:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch samples for approval' }
    }
}

/**
 * Gets the count of samples awaiting manager approval (status='review')
 */
export async function getSamplesForApprovalCount() {
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
            return { error: 'Only managers can view approval queue' }
        }

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
 * Gets samples filtered by tab (Manager only)
 * Returns samples with status 'review' or 'completed' based on tab parameter
 * Includes result counts and CoA status
 */
export async function getSamplesWithTab(tab: 'review' | 'completed') {
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

        // Map tab to status
        const status = tab === 'review' ? 'review' : 'completed'

        // Fetch samples filtered by status
        const { data: samples, error } = await supabase
            .from('samples')
            .select(
                `
                id,
                sample_id,
                client_name,
                status,
                received_at,
                updated_at,
                received_by_user:users!samples_received_by_fkey(full_name),
                results(id, status),
                coa_reports!left(status)
            `
            )
            .eq('status', status)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('Error fetching samples with tab:', error)
            return { error: error.message }
        }

        // Transform data with result counts (computed from nested results, no additional queries)
        const samplesWithCounts = samples.map((sample) => {
            const results = sample.results || []
            const totalTests = results.length
            const pendingCount = results.filter((r) => r.status === 'pending').length
            const enteredCount = results.filter((r) => r.status === 'entered').length
            const approvedCount = results.filter((r) => r.status === 'approved').length

            return {
                id: sample.id,
                sample_id: sample.sample_id,
                client_name: sample.client_name,
                status: sample.status,
                received_at: sample.received_at,
                updated_at: sample.updated_at,
                received_by_name: (sample.received_by_user as unknown as { full_name: string } | null)?.full_name || null,
                total_tests: totalTests,
                pending_count: pendingCount,
                entered_count: enteredCount,
                approved_count: approvedCount,
                coa_reports: sample.coa_reports || null,
            }
        })

        return { data: samplesWithCounts }
    } catch (error) {
        console.error('Error in getSamplesWithTab:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch samples' }
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

        // Verify user is analyst (RPC enforces too, but this provides clearer errors)
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'analyst') {
            return { error: 'Only analysts can submit samples for review' }
        }

        // Use RPC so submission works even when sample was received by a manager (RLS can make UPDATE affect 0 rows)
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

        // 5. Revalidate paths
        revalidatePath('/analyst/samples')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')
        revalidatePath('/analyst/results/[sampleId]', 'page')

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
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return { error: 'Unauthorized' }

        // Verify manager role
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Only managers can reject samples' }
        }

        const validatedData = RejectSampleSchema.parse(data)

        // Verify sample is in 'review' status
        const { data: sample } = await supabase
            .from('samples')
            .select('id, status')
            .eq('id', validatedData.sampleId)
            .single()

        if (!sample) return { error: 'Sample not found' }
        if (sample.status !== 'review') {
            return { error: 'Can only reject samples with status "review"' }
        }

        // Update sample status back to 'in_progress'
        const { error: updateError } = await supabase
            .from('samples')
            .update({
                status: 'in_progress',
                rejection_reason: validatedData.reason,
                rejected_at: new Date().toISOString(),
                rejected_by: user.id
            })
            .eq('id', validatedData.sampleId)

        if (updateError) return { error: updateError.message }

        revalidatePath('/manager/approvals')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')
        revalidatePath(`/manager/results/${validatedData.sampleId}`)

        return { success: true }
    } catch (error) {
        console.error('Error in rejectSample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to reject sample' }
    }
}

/**
 * Discards a sample under review (Manager only)
 * Changes status: 'review' -> 'discarded'
 */
export async function discardSample(data: DiscardSample) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return { error: 'Unauthorized' }

        // Verify manager role
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Only managers can discard samples' }
        }

        const validatedData = DiscardSampleSchema.parse(data)

        // Verify sample is in a discardable status
        const { data: sample } = await supabase
            .from('samples')
            .select('id, status')
            .eq('id', validatedData.sampleId)
            .single()

        if (!sample) return { error: 'Sample not found' }

        // Allow discard for received, assigned, or review status
        const discardableStatuses = ['received', 'assigned', 'review']
        if (!discardableStatuses.includes(sample.status)) {
            return { error: `Cannot discard samples with status "${sample.status}". Only received, assigned, or review samples can be discarded.` }
        }

        // Update sample status to 'discarded'
        const { error: updateError } = await supabase
            .from('samples')
            .update({
                status: 'discarded',
                rejection_reason: validatedData.reason,
                rejected_at: new Date().toISOString(),
                rejected_by: user.id
            })
            .eq('id', validatedData.sampleId)

        if (updateError) return { error: updateError.message }

        revalidatePath('/manager/approvals')
        revalidatePath('/manager/samples')
        revalidatePath('/samples')
        revalidatePath(`/manager/results/${validatedData.sampleId}`)

        return { success: true }
    } catch (error) {
        console.error('Error in discardSample:', error)
        return { error: error instanceof Error ? error.message : 'Failed to discard sample' }
    }
}
