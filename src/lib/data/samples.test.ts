import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockRpc = vi.fn()
const mockGetUser = vi.fn()
const mockUserSelect = vi.fn()
const mockUserEq = vi.fn()
const mockUserSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { fetchSamples } from './samples'

const TEST_RECEIVER_ID = '11111111-1111-4111-8111-111111111111'
const TEST_SEED_STYLE_RECEIVER_ID = 'd0000000-0000-0000-0000-000000000001'
const TEST_SPECIALTY_ID_1 = '22222222-2222-4222-8222-222222222222'
const TEST_SPECIALTY_ID_2 = '33333333-3333-4333-8333-333333333333'

function buildSampleRow() {
    return {
        id: '44444444-4444-4444-8444-444444444444',
        sample_id: 'S-0001',
        client_id: '55555555-5555-4555-8555-555555555555',
        client_name: 'Bệnh nhân A',
        type: 'Máu',
        status: 'received',
        received_at: '2026-03-19T09:00:00.000Z',
        received_by: TEST_RECEIVER_ID,
        received_by_name: 'Nguyễn Văn A',
        created_at: '2026-03-19T09:00:00.000Z',
        updated_at: '2026-03-19T10:00:00.000Z',
        deleted_at: null,
        rejection_reason: null,
        rejected_at: null,
        rejected_by: null,
    }
}

describe('fetchSamples query optimization', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockGetUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
        })

        mockUserSelect.mockReturnValue({ eq: mockUserEq })
        mockUserEq.mockReturnValue({ single: mockUserSingle })
        mockUserSingle.mockResolvedValue({
            data: { can_access_confidential: true },
            error: null,
        })

        mockRpc.mockResolvedValue({
            data: {
                rows: [],
                total_count: 0,
            },
            error: null,
        })

        mockCreateClient.mockResolvedValue({
            auth: {
                getUser: mockGetUser,
            },
            from: (table: string) => {
                if (table === 'users') {
                    return { select: mockUserSelect }
                }

                throw new Error(`Unexpected table: ${table}`)
            },
            rpc: mockRpc,
        })
    })

    it('calls the paginated samples RPC with active-scope defaults', async () => {
        await fetchSamples({ page: 1, pageSize: 20 })

        expect(mockRpc).toHaveBeenCalledWith('get_samples_page', {
            p_search: null,
            p_scope: 'active',
            p_status: null,
            p_rejected_only: false,
            p_from_date: null,
            p_to_date: null,
            p_receiver_id: null,
            p_specialty_ids: null,
            p_sort_by: 'updated_at',
            p_sort_order: 'desc',
            p_page: 1,
            p_page_size: 20,
        })
    })

    it('filters invalid specialty ids before calling the RPC', async () => {
        await fetchSamples({
            page: 2,
            pageSize: 10,
            receiverId: TEST_RECEIVER_ID,
            specialtyIds: `${TEST_SPECIALTY_ID_1},not-a-uuid,${TEST_SPECIALTY_ID_2}`,
            sortBy: 'received_at',
            sortOrder: 'asc',
        })

        expect(mockRpc).toHaveBeenCalledWith('get_samples_page', {
            p_search: null,
            p_scope: 'active',
            p_status: null,
            p_rejected_only: false,
            p_from_date: null,
            p_to_date: null,
            p_receiver_id: TEST_RECEIVER_ID,
            p_specialty_ids: [TEST_SPECIALTY_ID_1, TEST_SPECIALTY_ID_2],
            p_sort_by: 'received_at',
            p_sort_order: 'asc',
            p_page: 2,
            p_page_size: 10,
        })
    })

    it('preserves seed-style receiver ids when calling the RPC', async () => {
        await fetchSamples({
            page: 1,
            pageSize: 20,
            receiverId: TEST_SEED_STYLE_RECEIVER_ID,
        })

        expect(mockRpc).toHaveBeenCalledWith('get_samples_page', {
            p_search: null,
            p_scope: 'active',
            p_status: null,
            p_rejected_only: false,
            p_from_date: null,
            p_to_date: null,
            p_receiver_id: TEST_SEED_STYLE_RECEIVER_ID,
            p_specialty_ids: null,
            p_sort_by: 'updated_at',
            p_sort_order: 'desc',
            p_page: 1,
            p_page_size: 20,
        })
    })

    it('falls back to updated_at for unsupported sort columns and maps rpc rows', async () => {
        mockRpc.mockResolvedValueOnce({
            data: {
                rows: [buildSampleRow()],
                total_count: 1,
            },
            error: null,
        })

        const result = await fetchSamples({
            page: 1,
            pageSize: 20,
            sortBy: 'sample_id',
            search: 'S-0001',
        })

        expect(mockRpc).toHaveBeenCalledWith('get_samples_page', {
            p_search: 'S-0001',
            p_scope: 'active',
            p_status: null,
            p_rejected_only: false,
            p_from_date: null,
            p_to_date: null,
            p_receiver_id: null,
            p_specialty_ids: null,
            p_sort_by: 'updated_at',
            p_sort_order: 'desc',
            p_page: 1,
            p_page_size: 20,
        })
        expect(result).toEqual({
            data: [buildSampleRow()],
            count: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
        })
    })

    it('passes rejectedOnly through to the RPC payload when enabled', async () => {
        await fetchSamples({
            page: 1,
            pageSize: 20,
            status: 'in_progress',
            rejectedOnly: true,
        })

        expect(mockRpc).toHaveBeenCalledWith('get_samples_page', {
            p_search: null,
            p_scope: 'active',
            p_status: 'in_progress',
            p_rejected_only: true,
            p_from_date: null,
            p_to_date: null,
            p_receiver_id: null,
            p_specialty_ids: null,
            p_sort_by: 'updated_at',
            p_sort_order: 'desc',
            p_page: 1,
            p_page_size: 20,
        })
    })
})
