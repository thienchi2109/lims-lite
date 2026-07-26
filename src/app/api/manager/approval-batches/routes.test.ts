import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    enabled: true,
    getApprovalBatchDetail: vi.fn(),
    getApprovalSelectAllSnapshot: vi.fn(),
    retryFailedApprovalBatch: vi.fn(),
    submitApprovalBatch: vi.fn(),
}))

vi.mock('@/lib/approval-batches/config', () => ({
    isBackgroundBatchResultApprovalEnabled: () => mocks.enabled,
}))

vi.mock('@/lib/approval-batches/server', () => ({
    getApprovalBatchDetail: (...args: unknown[]) =>
        mocks.getApprovalBatchDetail(...args),
    getApprovalSelectAllSnapshot: (...args: unknown[]) =>
        mocks.getApprovalSelectAllSnapshot(...args),
    retryFailedApprovalBatch: (...args: unknown[]) =>
        mocks.retryFailedApprovalBatch(...args),
    submitApprovalBatch: (...args: unknown[]) =>
        mocks.submitApprovalBatch(...args),
}))

import { POST as submit } from './route'
import { GET as selectAll } from './select-all/route'
import { GET as getDetail } from './[batchId]/route'
import { POST as retry } from './[batchId]/retry/route'

const BATCH_ID = '22222222-2222-4222-8222-222222222222'
const REQUEST_KEY = '44444444-4444-4444-8444-444444444444'
const SAMPLE_IDS = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
]

function mutationRequest(path: string, body: unknown) {
    return new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            origin: 'http://localhost',
        },
        body: JSON.stringify(body),
    })
}

describe('manager approval batch API routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.enabled = true
        mocks.getApprovalSelectAllSnapshot.mockResolvedValue({
            ok: true,
            data: { sampleIds: SAMPLE_IDS, count: 2 },
        })
        mocks.submitApprovalBatch.mockResolvedValue({
            ok: true,
            data: { batchId: BATCH_ID },
        })
        mocks.retryFailedApprovalBatch.mockResolvedValue({
            ok: true,
            data: { batchId: BATCH_ID },
        })
        mocks.getApprovalBatchDetail.mockResolvedValue({
            ok: false,
            status: 404,
            error: { code: 'BATCH_NOT_FOUND' },
        })
    })

    it.each([
        ['select-all', async () => selectAll(new Request(
            'http://localhost/api/manager/approval-batches/select-all',
        ))],
        ['submit', async () => submit(mutationRequest(
            '/api/manager/approval-batches',
            {
                requestKey: REQUEST_KEY,
                selectionMode: 'selected',
                sampleIds: SAMPLE_IDS,
            },
        ))],
        ['retry', async () => retry(
            mutationRequest(
                `/api/manager/approval-batches/${BATCH_ID}/retry`,
                { parentBatchId: BATCH_ID, requestKey: REQUEST_KEY },
            ),
            { params: Promise.resolve({ batchId: BATCH_ID }) },
        )],
    ])('rejects direct %s requests while the server flag is disabled', async (_, call) => {
        mocks.enabled = false

        const response = await call()

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({
            error: { code: 'BATCH_DISABLED' },
        })
        expect(mocks.getApprovalSelectAllSnapshot).not.toHaveBeenCalled()
        expect(mocks.submitApprovalBatch).not.toHaveBeenCalled()
        expect(mocks.retryFailedApprovalBatch).not.toHaveBeenCalled()
    })

    it('returns 202 plus batchId for accepted and replayed submissions', async () => {
        const response = await submit(mutationRequest(
            '/api/manager/approval-batches',
            {
                requestKey: REQUEST_KEY,
                selectionMode: 'selected',
                sampleIds: SAMPLE_IDS,
            },
        ))

        expect(response.status).toBe(202)
        await expect(response.json()).resolves.toEqual({ batchId: BATCH_ID })
    })

    it('returns 202 plus batchId for an accepted failed-item retry', async () => {
        const response = await retry(
            mutationRequest(
                `/api/manager/approval-batches/${BATCH_ID}/retry`,
                { parentBatchId: BATCH_ID, requestKey: REQUEST_KEY },
            ),
            { params: Promise.resolve({ batchId: BATCH_ID }) },
        )

        expect(response.status).toBe(202)
        await expect(response.json()).resolves.toEqual({ batchId: BATCH_ID })
    })

    it('rejects malformed and cross-origin submissions before the server RPC', async () => {
        const malformed = await submit(mutationRequest(
            '/api/manager/approval-batches',
            {
                requestKey: REQUEST_KEY,
                selectionMode: 'selected',
                sampleIds: [SAMPLE_IDS[0], SAMPLE_IDS[0]],
            },
        ))
        expect(malformed.status).toBe(400)

        const crossOrigin = await submit(new Request(
            'http://localhost/api/manager/approval-batches',
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    origin: 'https://attacker.example',
                },
                body: JSON.stringify({
                    requestKey: REQUEST_KEY,
                    selectionMode: 'selected',
                    sampleIds: SAMPLE_IDS,
                }),
            },
        ))
        expect(crossOrigin.status).toBe(403)
        expect(mocks.submitApprovalBatch).not.toHaveBeenCalled()
    })

    it('rejects cross-origin retries before the server RPC', async () => {
        const response = await retry(
            new Request(
                `http://localhost/api/manager/approval-batches/${BATCH_ID}/retry`,
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        origin: 'https://attacker.example',
                    },
                    body: JSON.stringify({
                        parentBatchId: BATCH_ID,
                        requestKey: REQUEST_KEY,
                    }),
                },
            ),
            { params: Promise.resolve({ batchId: BATCH_ID }) },
        )

        expect(response.status).toBe(403)
        expect(mocks.retryFailedApprovalBatch).not.toHaveBeenCalled()
    })

    it('rejects caller-supplied result snapshots so the server contract owns them', async () => {
        const response = await submit(mutationRequest(
            '/api/manager/approval-batches',
            {
                requestKey: REQUEST_KEY,
                selectionMode: 'selected',
                sampleIds: SAMPLE_IDS,
                resultIds: SAMPLE_IDS,
            },
        ))

        expect(response.status).toBe(400)
        expect(mocks.submitApprovalBatch).not.toHaveBeenCalled()
    })

    it('returns concealed owner-scoped detail errors with validated pagination', async () => {
        const response = await getDetail(
            new Request(
                `http://localhost/api/manager/approval-batches/${BATCH_ID}?page=2&pageSize=25`,
            ),
            { params: Promise.resolve({ batchId: BATCH_ID }) },
        )

        expect(mocks.getApprovalBatchDetail).toHaveBeenCalledWith(
            expect.any(Request),
            BATCH_ID,
            { page: 2, pageSize: 25 },
        )
        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({
            error: { code: 'BATCH_NOT_FOUND' },
        })
    })

    it('keeps owner detail reads available while batch entry points are disabled', async () => {
        mocks.enabled = false

        const response = await getDetail(
            new Request(
                `http://localhost/api/manager/approval-batches/${BATCH_ID}`,
            ),
            { params: Promise.resolve({ batchId: BATCH_ID }) },
        )

        expect(response.status).toBe(404)
        expect(mocks.getApprovalBatchDetail).toHaveBeenCalledOnce()
    })
})
