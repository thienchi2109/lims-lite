import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    fetchApprovalBatchClient,
    fetchApprovalSelectAllClient,
    retryApprovalBatchClient,
    submitApprovalBatchClient,
} from './api-client'

const BATCH_ID = '22222222-2222-4222-8222-222222222222'
const REQUEST_KEY = '44444444-4444-4444-8444-444444444444'
const SAMPLE_IDS = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
]
const NOW = '2026-07-26T12:00:00.000Z'

describe('approval batch api-client integration', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('routes select-all and submit through dedicated same-origin APIs', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                sampleIds: SAMPLE_IDS,
                count: 2,
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                batchId: BATCH_ID,
            }), {
                status: 202,
                headers: { 'content-type': 'application/json' },
            }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchApprovalSelectAllClient()).resolves.toEqual({
            sampleIds: SAMPLE_IDS,
            count: 2,
        })
        await expect(submitApprovalBatchClient({
            requestKey: REQUEST_KEY,
            selectionMode: 'selected',
            sampleIds: SAMPLE_IDS,
        })).resolves.toEqual({ batchId: BATCH_ID })

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            '/api/manager/approval-batches/select-all',
            expect.objectContaining({
                credentials: 'include',
            }),
        )
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            '/api/manager/approval-batches',
            expect.objectContaining({
                method: 'POST',
                credentials: 'include',
            }),
        )
    })

    it('validates detail and retry responses with the P0 schemas', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                progress: {
                    batchId: BATCH_ID,
                    status: 'completed',
                    totalCount: 2,
                    queuedCount: 0,
                    processingCount: 0,
                    retryWaitCount: 0,
                    succeededCount: 2,
                    failedCount: 0,
                    createdAt: NOW,
                    startedAt: NOW,
                    completedAt: NOW,
                    updatedAt: NOW,
                },
                outcomes: {
                    batchId: BATCH_ID,
                    items: [],
                    page: 1,
                    pageSize: 50,
                    totalCount: 0,
                    totalPages: 0,
                },
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                batchId: BATCH_ID,
            }), {
                status: 202,
                headers: { 'content-type': 'application/json' },
            }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchApprovalBatchClient(BATCH_ID, {
            page: 1,
            pageSize: 50,
        })).resolves.toMatchObject({
            progress: { batchId: BATCH_ID },
            outcomes: { page: 1, pageSize: 50 },
        })
        await expect(retryApprovalBatchClient({
            parentBatchId: BATCH_ID,
            requestKey: REQUEST_KEY,
        })).resolves.toEqual({ batchId: BATCH_ID })
    })

    it('rejects malformed success payloads and maps typed API errors to Vietnamese', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                batchId: 'not-a-uuid',
            }), {
                status: 202,
                headers: { 'content-type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                error: { code: 'REQUEST_CONFLICT' },
            }), {
                status: 409,
                headers: { 'content-type': 'application/json' },
            }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(submitApprovalBatchClient({
            requestKey: REQUEST_KEY,
            selectionMode: 'selected',
            sampleIds: SAMPLE_IDS,
        })).rejects.toThrow('Phản hồi phê duyệt hàng loạt không hợp lệ')

        await expect(retryApprovalBatchClient({
            parentBatchId: BATCH_ID,
            requestKey: REQUEST_KEY,
        })).rejects.toThrow('Yêu cầu phê duyệt trùng mã nhưng khác nội dung.')
    })
})
