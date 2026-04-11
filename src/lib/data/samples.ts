import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/utils-lims'
import {
    getConfidentialAssociatedSampleIds,
    getUserConfidentialAccess,
} from './confidential-samples'
import {
    SampleListParamsSchema,
    type SampleListParams,
    type SampleWithUser,
} from '@/types'

const SAMPLE_SORT_COLUMNS = new Set(['received_at', 'updated_at'])

interface FetchSamplesRpcPayload {
    rows?: SampleWithUser[]
    total_count?: number | string | null
}

function normalizeReceiverId(receiverId: SampleListParams['receiverId']) {
    return typeof receiverId === 'string' && isValidUUID(receiverId)
        ? receiverId
        : undefined
}

function normalizeSortBy(sortBy: SampleListParams['sortBy']) {
    return sortBy && SAMPLE_SORT_COLUMNS.has(sortBy) ? sortBy : 'updated_at'
}

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

    const access = await getUserConfidentialAccess(user.id, supabase)
    if (access.error) {
        return { error: access.error }
    }

    const isDoctor = access.role === 'doctor'
    const receiverId = normalizeReceiverId(params.receiverId)

    // Validate params
    const validatedParams = SampleListParamsSchema.parse({
        ...params,
        receiverId,
        scope: isDoctor ? 'all' : params.scope,
        status: isDoctor ? 'completed' : params.status,
    })
    const resolvedScope = validatedParams.scope ?? 'active'
    const specialtyIds = validatedParams.specialtyIds
        ?.split(',')
        .filter(isValidUUID)

    const sortBy = normalizeSortBy(validatedParams.sortBy)
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc'
    const toDate = validatedParams.toDate
        ? new Date(new Date(validatedParams.toDate).setHours(23, 59, 59, 999)).toISOString()
        : null

    const { data, error } = await supabase.rpc('get_samples_page', {
        p_search: validatedParams.search ?? null,
        p_scope: resolvedScope,
        p_status: validatedParams.status ?? null,
        p_from_date: validatedParams.fromDate ?? null,
        p_to_date: toDate,
        p_receiver_id: validatedParams.receiverId ?? null,
        p_specialty_ids: specialtyIds && specialtyIds.length > 0 ? specialtyIds : null,
        p_sort_by: sortBy,
        p_sort_order: sortOrder,
        p_page: validatedParams.page,
        p_page_size: validatedParams.pageSize,
    })

    if (error) {
        console.error('Error fetching samples:', error)
        return { error: error.message }
    }

    const payload = (data ?? {}) as FetchSamplesRpcPayload
    const samples = Array.isArray(payload.rows) ? payload.rows : []
    const count = Number(payload.total_count ?? 0)

    if (access.canAccessConfidential) {
        return {
            data: samples,
            count,
            page: validatedParams.page,
            pageSize: validatedParams.pageSize,
            totalPages: Math.ceil(count / validatedParams.pageSize),
        }
    }

    let confidentialSampleIds: { data: Set<string> }
    try {
        confidentialSampleIds = await getConfidentialAssociatedSampleIds(
            samples.map((sample) => sample.id),
        )
    } catch (error) {
        console.error('Error verifying confidential sample associations:', error)
        return { error: 'Không thể tải danh sách mẫu' }
    }

    if (confidentialSampleIds.data.size > 0) {
        console.error('Confidential samples leaked from get_samples_page RPC', {
            leakedSampleIds: [...confidentialSampleIds.data],
        })
        return { error: 'Không thể tải danh sách mẫu' }
    }

    return {
        data: samples,
        count,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        totalPages: Math.ceil(count / validatedParams.pageSize),
    }
}
