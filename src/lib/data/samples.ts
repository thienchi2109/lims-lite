import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/utils-lims'
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

    // Normalize receiverId to a valid UUID (or undefined) before validation
    const receiverId =
        typeof params.receiverId === 'string' &&
        params.receiverId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/)
            ? params.receiverId
            : undefined

    // Validate params
    const validatedParams = SampleListParamsSchema.parse({
        ...params,
        receiverId,
    })
    const resolvedScope = validatedParams.scope ?? 'active'

    // Build query
    let query = supabase.from('samples').select('*', { count: 'exact' }).is('deleted_at', null)

    // Apply status filter
    if (validatedParams.status) {
        query = query.eq('status', validatedParams.status)
    } else if (resolvedScope === 'active') {
        query = query.neq('status', 'completed')
    }

    // Apply receiver filter
    if (validatedParams.receiverId) {
        query = query.eq('received_by', validatedParams.receiverId)
    }

    // Apply search filter
    if (validatedParams.search) {
        let receiverIdsFromSearch: string[] = []

        const { data: receiverMatches, error: receiverSearchError } = await supabase
            .from('users')
            .select('id')
            .ilike('full_name', `%${validatedParams.search}%`)

        if (receiverSearchError) {
            console.error('Error fetching receivers for search:', receiverSearchError)
        } else if (receiverMatches) {
            receiverIdsFromSearch = receiverMatches.map((r: any) => r.id).filter(Boolean)
        }

        const searchFilters = [
            `sample_id.ilike.%${validatedParams.search}%`,
            `client_name.ilike.%${validatedParams.search}%`,
        ]

        if (receiverIdsFromSearch.length > 0) {
            const receiverList = receiverIdsFromSearch.join(',')
            searchFilters.push(`received_by.in.(${receiverList})`)
        }

        query = query.or(searchFilters.join(','))
    }

    // Apply date range filter
    if (validatedParams.fromDate) {
        query = query.gte('received_at', validatedParams.fromDate)
    }
    if (validatedParams.toDate) {
        // Add time to the end of the day to include the entire day
        const endOfDay = new Date(validatedParams.toDate)
        endOfDay.setHours(23, 59, 59, 999)
        query = query.lte('received_at', endOfDay.toISOString())
    }

    // Apply lab specialty filter (OR logic - any match)
    // Uses RPC function to avoid HTTP 414 (URI Too Long) with large result sets
    if (validatedParams.specialtyIds) {
        // Parse and validate UUID format
        const specialtyIds = validatedParams.specialtyIds
            .split(',')
            .filter(isValidUUID)

        if (specialtyIds.length > 0) {
            // Call RPC function for scalable server-side filtering
            const { data: matchingSamples, error: rpcError } = await supabase
                .rpc('get_sample_ids_by_specialty', {
                    p_specialty_ids: specialtyIds
                })

            if (rpcError) {
                console.error('Error calling get_sample_ids_by_specialty:', rpcError)
                // Fall back to empty result on error
                query = query.eq('id', '00000000-0000-0000-0000-000000000000')
            } else if (matchingSamples && matchingSamples.length > 0) {
                const sampleIds = matchingSamples.map((r: { sample_id: string }) => r.sample_id)
                query = query.in('id', sampleIds)
            } else {
                // No matching samples - return empty result
                query = query.eq('id', '00000000-0000-0000-0000-000000000000')
            }
        }
    }

    // Apply sorting
    const sortBy = validatedParams.sortBy || 'updated_at'
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
