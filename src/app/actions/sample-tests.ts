'use server'

/**
 * Sample Tests - Test assignment and management operations
 * Functions: assignTests, unassignTests, getAssayDefinitions, getSampleTests
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import { AssignTestsSchema, AssignTestsV2Schema, type AssignTests, type ResultStatus } from '@/types'
import { getAssayDefinitionMethodName } from '@/lib/assay-method-name'
import {
    createLegacyAssignmentRequestError,
    hasAssignmentV2Fields,
    mapAssignmentV2ActionError,
    mapAssignmentV2RpcError,
} from './sample-assignment-v2-errors'

/**
 * Raw result with joined assay and method for getSampleTests query
 */
interface RawTestResult {
    id: string
    sample_id: string
    assay_id: string
    method_id: string | null
    value: string | null
    status: ResultStatus
    entered_by: string | null
    entered_at: string | null
    created_at: string
    updated_at: string
    assay: { id: string; name: string; units: string | null; method_name: string | null } | null
    method: { id: string; name: string } | null
}

/**
 * Assigns tests to a sample
 * - Managers: Can assign at any status
 * - Analysts: Can only assign when status is 'received' or 'assigned'
 */
export async function assignTests(data: AssignTests) {
    try {
        const auth = await requireRole(['analyst', 'manager'])
        if (isAuthError(auth)) return { error: 'Không có quyền chỉ định xét nghiệm' }

        if (!hasAssignmentV2Fields(data)) {
            return createLegacyAssignmentRequestError()
        }

        const supabase = await createClient()
        const validatedData = AssignTestsV2Schema.parse(data)

        const { data: rpcResult, error: rpcError } = await supabase.rpc('assign_tests_to_sample_v2', {
            p_sample_id: validatedData.sampleId,
            p_sample_type_id: validatedData.sampleTypeId,
            p_tests: validatedData.tests,
            p_expected_revision_number: validatedData.expectedRevisionNumber,
        })

        if (rpcError) {
            console.error('Error in assign_tests_to_sample_v2 RPC:', rpcError)
            return { error: mapAssignmentV2RpcError(rpcError) }
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
        return { error: mapAssignmentV2ActionError(error) }
    }
}

/**
 * Removes test assignments from a sample (Manager only)
 * Only allows removing tests that are still in 'pending' status
 */
export async function unassignTests(data: AssignTests) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return { error: 'Only managers can unassign tests' }

        const supabase = await createClient()
        const validatedData = AssignTestsSchema.parse(data)

        const assayIds = validatedData.tests.map(t => t.assayId)

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

        const { count } = await supabase
            .from('results')
            .select('*', { count: 'exact', head: true })
            .eq('sample_id', validatedData.sampleId)

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

        const transformedAssays = assays.map((assay) => {
            const defaultMethodLink = assay.assay_methods?.find(
                (am: { is_default: boolean }) => am.is_default
            )
            const methodDetail = defaultMethodLink?.method as { id: string; name: string } | null

            const { assay_methods, ...assayData } = assay
            return {
                ...assayData,
                method_name: getAssayDefinitionMethodName({
                    method_name: assayData.method_name,
                    methods: methodDetail ? [{ name: methodDetail.name, is_default: true }] : [],
                }) || null,
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
            .select(`
                *,
                assay:assay_definitions(id, name, units, method_name),
                method:methods(id, name)
            `)
            .eq('sample_id', sampleId)

        if (error) {
            console.error('Error fetching sample tests:', error)
            return { error: error.message }
        }

        const transformedResults = (results as unknown as RawTestResult[]).map((r) => ({
            ...r,
            assay: {
                ...r.assay,
                method: r.method
                    ? { id: r.method.id, name: r.method.name }
                    : r.assay?.method_name
                        ? { id: null, name: r.assay.method_name }
                        : null
            }
        }))

        return { data: transformedResults }
    } catch (error) {
        console.error('Error in getSampleTests:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch sample tests' }
    }
}
