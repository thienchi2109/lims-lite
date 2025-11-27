import { createClient } from '@/lib/supabase/server'
import {
    SampleListParamsSchema,
    type SampleListParams,
    type SampleWithUser,
} from '@/types'

/**
 * Server-side helper to fetch paginated samples with filters.
 * Can be safely imported into Server Components (no Server Action boundary).
 */
export async function fetchSamples(params: SampleListParams) {
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
    let query = supabase.from('samples').select('*', { count: 'exact' }).is('deleted_at', null)

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

    // Fetch received_by user names (avoid relying on PostgREST relationship cache)
    const receivedByIds = Array.from(new Set(samples.map((s: any) => s.received_by).filter(Boolean)))

    let userMap: Record<string, string> = {}
    if (receivedByIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, full_name').in('id', receivedByIds)

        if (users) {
            userMap = users.reduce((acc: Record<string, string>, user: any) => {
                acc[user.id] = user.full_name
                return acc
            }, {})
        }
    }

    // Transform data to flatten received_by_name
    const transformedSamples: SampleWithUser[] = samples.map((sample: any) => ({
        ...sample,
        received_by_name: sample.received_by ? userMap[sample.received_by] || null : null,
    }))

    return {
        data: transformedSamples,
        count: count || 0,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        totalPages: Math.ceil((count || 0) / validatedParams.pageSize),
    }
}
