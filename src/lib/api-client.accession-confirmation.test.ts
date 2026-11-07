// @vitest-environment node
// Browser recovery contract: each explicit action reconciles durable status before any write.
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from './api-client'

const batchId = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const ready = { state: 'preview_ready', batchId }
const unknown = { state: 'unknown', batchId }
const receipt = { batch_id: batchId, owner_id: other, confirmation_received_at: '2026-11-06T01:00:00Z',
    client_count: 1, sample_count: 1, assignment_count: 1, create_count: 0, reuse_count: 1 }
const success = { state: 'succeeded', receipt }
const file = () => new File(['EXACT_ORIGINAL_BYTES'], 'private-workbook.xlsx')
const url = `/api/accession-confirmation/${batchId}`
const json = (body: unknown, status?: number) => {
    const state = (body as { state?: string })?.state
    return Response.json(body, { status: status ?? (state === 'unknown' ? 503
        : ['processing', 'preparing'].includes(state ?? '') ? 202 : ['failed', 'rejected', 'expired'].includes(state ?? '') ? 422 : 200) })
}

async function readSamples(id = batchId, options: { signal?: AbortSignal } = {}) {
    const reader = Reflect.get(client, 'fetchAccessionReceiptSamplesClient')
    expect(reader, 'owner-authorized sample ID reader must exist').toBeTypeOf('function')
    return reader(id, options)
}

describe('committed accession sample ID browser reader', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
    const samples = { batchId, samples: [{ row: 2, sampleId: other, officialSampleIdentifier: 'CDC-2026-000001' }] }

    it('reads real sample IDs without a file through credentialed no-store GET', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(samples))
        const signal = new AbortController().signal
        await expect(readSamples(batchId, { signal })).resolves.toEqual(samples)
        expect(fetch).toHaveBeenCalledExactlyOnceWith(`${url}/samples`, {
            method: 'GET', credentials: 'include', cache: 'no-store', signal,
        })
        expect(fetch.mock.calls[0][1]?.body).toBeUndefined()
    })

    it('rejects an invalid batch locator before fetch', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch')
        await expect(readSamples('../foreign')).rejects.toMatchObject({ name: 'ZodError' })
        expect(fetch).not.toHaveBeenCalled()
    })

    it.each([
        null, { ...samples, batchId: other }, { ...samples, samples: [] },
        { ...samples, samples: [{ ...samples.samples[0], sampleId: 'invalid' }] },
        { ...samples, samples: [{ ...samples.samples[0], officialSampleIdentifier: '' }] },
        { ...samples, samples: [samples.samples[0], samples.samples[0]] },
        { ...samples, samples: [{ ...samples.samples[0], clientName: 'RAW_PRIVATE' }] },
    ])('fails closed for malformed/unlinked sample IDs %#', async body => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(body))
        await expect(readSamples()).rejects.toThrow('Chưa thể tải mã mẫu')
    })

    it.each([403, 409, 503])('conceals upstream error details for HTTP %s without changing receipt status', async status => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'RAW_PRIVATE' }, status))
        await expect(readSamples()).rejects.toThrow(status === 403 ? 'Bạn không có quyền truy cập lần nhập này.' : 'Chưa thể tải mã mẫu')
    })

    it('retains existing session-expiry redirect handling', async () => {
        const location = { href: '' }; vi.stubGlobal('window', { location })
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'RAW_SESSION' }, 401))
        await expect(readSamples()).rejects.toThrow('Phiên đăng nhập đã hết hạn.')
        expect(location.href).toBe('/login?reason=session_expired')
    })

    it('reports a safe read error after transport loss', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('RAW_CONNECTION'))
        await expect(readSamples()).rejects.toThrow('Chưa thể tải mã mẫu')
    })
})

describe('accession confirmation browser recovery', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

    it('retrieves a durable receipt without a workbook using credentialed no-store GET', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(success))
        await expect(client.fetchAccessionConfirmationStatusClient(batchId)).resolves.toEqual(success)
        expect(fetch).toHaveBeenCalledExactlyOnceWith(url, expect.objectContaining({
            method: 'GET', credentials: 'include', cache: 'no-store',
        }))
        expect(fetch.mock.calls[0][1]?.body).toBeUndefined()
    })

    it.each(['preparing', 'processing', 'unknown', 'failed', 'rejected', 'expired'])('retains safe %s even on its non-2xx response', async state => {
        const result = { state, batchId }
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(result,
            state === 'unknown' ? 503 : ['failed', 'rejected', 'expired'].includes(state) ? 422 : 202))
        await expect(client.fetchAccessionConfirmationStatusClient(batchId)).resolves.toEqual(result)
    })

    it.each([
        { state: 'processing', batchId, sample_id: other },
        { state: 'failed', batchId, reasonCode: 'RAW_CELL_SECRET' },
        { state: 'preview_ready', batchId: other },
        { ...success, receipt: { ...receipt, batch_id: other } },
        { ...success, receipt: { ...receipt, create_count: 1 } },
        { ...success, receipt: { ...receipt, workbook: 'RAW_CELL_SECRET' } },
    ])('fails closed for untrusted status/receipt %j', async body => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(body))
        await expect(client.fetchAccessionConfirmationStatusClient(batchId)).resolves.toEqual(unknown)
    })

    it('keeps DB/proxy/JSON uncertainty unknown and never treats a timeout as failed', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch')
            .mockRejectedValueOnce(new DOMException('RAW_TIMEOUT', 'TimeoutError'))
            .mockResolvedValueOnce(new Response('RAW_PROXY', { status: 504 }))
            .mockResolvedValueOnce(json({ error: 'RAW_DATABASE' }, 503))
        for (let i = 0; i < 3; i++) {
            await expect(client.fetchAccessionConfirmationStatusClient(batchId)).resolves.toEqual(unknown)
        }
        expect(fetch).toHaveBeenCalledTimes(3)
    })

    it.each([[success, 503], [ready, 422], [{ state: 'failed', batchId }, 504]])('rejects mismatched HTTP/outcome contracts', async (body, status) => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(body, status as number))
        await expect(client.fetchAccessionConfirmationStatusClient(batchId)).resolves.toEqual(unknown)
    })

    it('retains session-expiry handling and uses a safe owner denial', async () => {
        const location = { href: '' }; vi.stubGlobal('window', { location })
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ error: 'RAW_AUTH' }, 401))
            .mockResolvedValueOnce(json({ error: 'RAW_OTHER_OWNER' }, 403))
        await expect(client.fetchAccessionConfirmationStatusClient(batchId)).rejects.toThrow('Phiên đăng nhập đã hết hạn.')
        expect(location.href).toBe('/login?reason=session_expired')
        await expect(client.confirmAccessionClient(batchId, file(), true)).rejects.toThrow('Bạn không có quyền truy cập lần nhập này.')
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('validates the batch ID before making any request', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch')
        await expect(client.fetchAccessionConfirmationStatusClient('../other')).rejects.toThrow()
        expect(fetch).not.toHaveBeenCalled()
    })

    it('checks status first, then sends only identical original bytes and explicit attestation once', async () => {
        const signal = new AbortController().signal
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(ready)).mockResolvedValueOnce(json(success))
        await expect(client.confirmAccessionClient(batchId, file(), true, { signal })).resolves.toEqual(success)
        expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'POST'])
        const init = fetch.mock.calls[1][1]!
        expect(init).toMatchObject({ credentials: 'include', signal })
        expect(init.headers).toBeUndefined()
        const body = init.body as FormData
        expect([...body.keys()]).toEqual(['file', 'acceptableQuality'])
        expect(await (body.get('file') as File).text()).toBe('EXACT_ORIGINAL_BYTES')
        expect(body.get('acceptableQuality')).toBe('true')
    })

    it.each(['preparing', 'processing', 'unknown', 'failed', 'rejected', 'expired'])('does not replay or create an attempt when lookup returns %s', async state => {
        const outcome = { state, batchId }
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(outcome))
        await expect(client.confirmAccessionClient(batchId, file(), true)).resolves.toEqual(outcome)
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch.mock.calls[0][1]?.method).toBe('GET')
    })

    it('loses a response before dispatch, then requires a fresh lookup before explicit retry', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('RAW_CONNECTION'))
            .mockResolvedValueOnce(json(ready)).mockResolvedValueOnce(json(success))
        await expect(client.confirmAccessionClient(batchId, file(), true)).resolves.toEqual(unknown)
        expect(fetch).toHaveBeenCalledTimes(1)
        await expect(client.confirmAccessionClient(batchId, file(), true)).resolves.toEqual(success)
        expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'GET', 'POST'])
    })

    it('loses the response after commit and recovers success without the file or a second POST', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(ready))
            .mockRejectedValueOnce(new Error('RAW_LOST_COMMITTED_RESPONSE')).mockResolvedValueOnce(json(success))
        await expect(client.confirmAccessionClient(batchId, file(), true)).resolves.toEqual(unknown)
        expect(fetch).toHaveBeenCalledTimes(2)
        await expect(client.confirmAccessionClient(batchId)).resolves.toEqual(success)
        expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'POST', 'GET'])
    })

    it('loses a dispatched response before commit, then observes ready and needs the original file for an explicit retry', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(ready))
            .mockRejectedValueOnce(new Error('RAW_DISCONNECT_BEFORE_COMMIT'))
            .mockResolvedValueOnce(json(ready)).mockResolvedValueOnce(json(ready)).mockResolvedValueOnce(json(success))
        await expect(client.confirmAccessionClient(batchId, file(), true)).resolves.toEqual(unknown)
        expect(fetch).toHaveBeenCalledTimes(2)
        // Reconciliation establishes rollback/unaccepted state; file loss itself authorizes no replay.
        await expect(client.confirmAccessionClient(batchId)).resolves.toEqual(ready)
        expect(fetch).toHaveBeenCalledTimes(3)
        await expect(client.confirmAccessionClient(batchId, file(), true)).resolves.toEqual(success)
        expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'POST', 'GET', 'GET', 'POST'])
    })

    it('requires selecting the original file when an unlocked preview is ready; never reconstructs it', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(ready))
        await expect(client.confirmAccessionClient(batchId)).resolves.toEqual(ready)
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch.mock.calls[0][1]?.body).toBeUndefined()
    })

    it.each([false, undefined])('requires explicit true quality before POST, received %s', async quality => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(ready))
        await expect(client.confirmAccessionClient(batchId, file(), quality)).rejects.toThrow('chất lượng')
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('does not confirm an original source at the strict decimal size ceiling', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(ready))
        await expect(client.confirmAccessionClient(batchId, new File([new Uint8Array(10000000)], 'large.xlsx'), true)).rejects.toThrow()
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it.each(['failed', 'rejected', 'expired', 'preview_ready'])('creates an explicit new linked preview after fresh %s lookup', async state => {
        const preview = { ok: true, batchId: other }
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ state, batchId }))
            .mockResolvedValueOnce(json(preview))
        await expect(client.retryAccessionPreviewClient(batchId, file())).resolves.toEqual(preview)
        expect(fetch.mock.calls.map(([path, init]) => [path, init?.method])).toEqual([[url, 'GET'], ['/api/accession-preview', 'POST']])
        const body = fetch.mock.calls[1][1]?.body as FormData
        expect([...body.keys()]).toEqual(['file', 'retryOfBatchId'])
        expect(body.get('retryOfBatchId')).toBe(batchId)
        expect(await (body.get('file') as File).text()).toBe('EXACT_ORIGINAL_BYTES')
    })

    it.each(['processing', 'unknown', 'preparing', 'succeeded'])('never creates a linked attempt for %s', async state => {
        const result = state === 'succeeded' ? success : { state, batchId }
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(result))
        await expect(client.retryAccessionPreviewClient(batchId, file())).resolves.toEqual(result)
        expect(fetch).toHaveBeenCalledTimes(1)
    })
})
