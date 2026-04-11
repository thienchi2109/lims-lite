'use server'

/**
 * Sample Operations - Core CRUD and accessioning
 * Functions: createSample, accessionAndAssignTests, updateSample, getSamples, getSample
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAuth, requireRole, isAuthError } from '@/lib/auth-helpers'
import {
    CreateSampleSchema,
    CreateSampleWithAssignmentsSchema,
    UpdateSampleSchema,
    type CreateSample,
    type CreateSampleWithAssignments,
    type UpdateSample,
    type SampleListParams,
} from '@/types'
import { fetchSamples } from '@/lib/data/samples'
import {
    isConfidentialAssociatedSample,
    getUserConfidentialAccess,
    SAMPLE_NOT_FOUND_ERROR,
} from '@/lib/data/confidential-samples'

/**
 * Creates a new sample with auto-generated sample ID
 */
export async function createSample(data: CreateSample) {
    try {
        const auth = await requireRole('analyst')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validatedData = CreateSampleSchema.parse(data)

        const { data: sample, error } = await supabase.rpc('create_sample_atomic', {
            p_client_id: validatedData.client_id,
            p_client_name: validatedData.client_name || null,
            p_type: validatedData.type,
            p_received_at: validatedData.received_at || null,
            p_received_by: auth.id,
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
 * Creates a sample and assigns tests in a single flow
 */
export async function accessionAndAssignTests(data: CreateSampleWithAssignments) {
    try {
        const auth = await requireRole('analyst')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validatedData = CreateSampleWithAssignmentsSchema.parse(data)

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
 * Type-safe field filtering using Object.fromEntries
 */
export async function updateSample(data: UpdateSample) {
    try {
        const auth = await requireAuth()
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validatedData = UpdateSampleSchema.parse(data)

        // Type-safe update: extract id, filter undefined values
        const { id, ...fields } = validatedData
        const updateData = Object.fromEntries(
            Object.entries(fields).filter(([, value]) => value !== undefined)
        ) as Partial<Omit<UpdateSample, 'id'>>

        const { data: sample, error } = await supabase
            .from('samples')
            .update(updateData)
            .eq('id', id)
            .select()

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
 * Gets a single sample by ID with related data
 */
export async function getSample(id: string) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        const { data: sample, error } = await supabase
            .from('samples')
            .select(`
                *,
                received_by_user:users!samples_received_by_fkey(full_name),
                rejected_by_user:users!samples_rejected_by_fkey(full_name),
                client:clients!samples_client_fk(
                    id,
                    id_card_num,
                    name,
                    date_of_birth,
                    gender,
                    phone,
                    address,
                    health_insurance_num,
                    expiry_date,
                    created_at,
                    updated_at
                )
            `)
            .eq('id', id)
            .single()

        if (error) {
            console.error('Error fetching sample:', error)
            if (error.code === 'PGRST116') {
                return { error: SAMPLE_NOT_FOUND_ERROR }
            }
            return { error: error.message }
        }

        const access = await getUserConfidentialAccess(user.id, supabase)
        if (access.error) {
            return { error: access.error }
        }

        if (access.role === 'doctor' && sample.status !== 'completed') {
            return { error: SAMPLE_NOT_FOUND_ERROR }
        }

        if (!access.canAccessConfidential) {
            const confidentiality = await isConfidentialAssociatedSample(id)
            if (confidentiality.data) {
                return { error: SAMPLE_NOT_FOUND_ERROR }
            }
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
