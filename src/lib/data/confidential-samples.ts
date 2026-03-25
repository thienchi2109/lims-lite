import { createAdminClient, createClient } from '@/lib/supabase/server'

export const SAMPLE_NOT_FOUND_ERROR = 'Không tìm thấy mẫu'
export const CONFIDENTIAL_ASSOCIATION_CHECK_FAILED_ERROR = 'Failed to evaluate confidential sample association'

type ConfidentialAccessClient = Awaited<ReturnType<typeof createClient>>

export async function getUserConfidentialAccess(
    userId: string,
    supabase?: ConfidentialAccessClient,
): Promise<{
    canAccessConfidential: boolean
    error?: string
}> {
    const client = supabase ?? await createClient()
    const { data, error } = await client
        .from('users')
        .select('can_access_confidential')
        .eq('id', userId)
        .single()

    if (error) {
        console.error('Error fetching user confidentiality access:', error)
        return {
            canAccessConfidential: false,
            error: error.message,
        }
    }

    return {
        canAccessConfidential: data?.can_access_confidential === true,
    }
}

export async function getConfidentialAssociatedSampleIds(sampleIds: string[]): Promise<{
    data: Set<string>
}> {
    if (sampleIds.length === 0) {
        return {
            data: new Set<string>(),
        }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('results')
        .select(`
            sample_id,
            assay:assay_definitions!results_assay_id_fkey!inner(
                is_confidential
            )
        `)
        .eq('assay.is_confidential', true)
        .in('sample_id', sampleIds)

    if (error) {
        console.error('Error fetching confidential-associated sample ids:', error)
        throw new Error(CONFIDENTIAL_ASSOCIATION_CHECK_FAILED_ERROR)
    }

    return {
        data: new Set(
            (data ?? []).map((row: { sample_id: string }) => row.sample_id),
        ),
    }
}

export async function isConfidentialAssociatedSample(sampleId: string): Promise<{
    data: boolean
}> {
    const result = await getConfidentialAssociatedSampleIds([sampleId])

    return {
        data: result.data.has(sampleId),
    }
}
