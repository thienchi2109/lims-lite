// @vitest-environment node
// HTTP admission tests: only authenticated SQL/orchestration transports are replaced.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), single: vi.fn(), getSession: vi.fn(), stepUp: vi.fn(), prepare: vi.fn(), config: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/manager-email-otp/guards', () => ({ shouldRequireManagerStepUp: mocks.stepUp }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
    from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ single: mocks.single }) }) }) }),
}) }))
vi.mock('@/lib/accession-preview/server', () => ({ prepareAccessionPreview: mocks.prepare, readPreviewConfiguration: mocks.config }))

import { POST as post } from './route'
const batchId = '11111111-1111-4111-8111-111111111111'
const result = { ok: true, batchId, previewCreatedAt: '2026-11-04T01:00:00Z', expiresAt: '2026-11-04T01:30:00Z',
    counts: { clients: 1, samples: 2, assignments: 3, create: 0, reuse: 1 },
    clients: [{ row: 2, disposition: 'reuse', input: { phone: '0987654321' }, existingValues: { phone: null }, unchangedFields: ['phone'] }] }
function form() { const data = new FormData(); data.set('file', new File([new Uint8Array([80, 75, 3, 4])], 'private-name.xlsx')); return data }
function request(data = form(), signal?: AbortSignal) { return new Request('http://localhost/api/accession-preview', { method: 'POST', body: data, signal }) }

describe('POST /api/accession-preview', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        mocks.getUser.mockResolvedValue({ data: { user: { id: batchId } }, error: null })
        mocks.single.mockResolvedValue({ data: { role: 'analyst', deleted_at: null, can_access_confidential: true, manager_otp_settings: [{ updated_at: 'version' }] }, error: null })
        mocks.getSession.mockResolvedValue({ data: { session: { access_token: `e30.${Buffer.from(JSON.stringify({ session_id: 'session-1' })).toString('base64url')}.synthetic` } } })
        mocks.stepUp.mockResolvedValue(false)
        mocks.config.mockReturnValue({ policy: { request: { maxBytes: 10002000, maxResponseBytes: 100000, timeoutMs: 10000 } } })
        mocks.prepare.mockResolvedValue(result)
    })
    afterEach(() => vi.useRealTimers())
    async function safe(response: Response, status: number) {
        expect(response.status).toBe(status)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        const body = await response.json()
        expect(JSON.stringify(body)).not.toMatch(/RAW_|private-name/)
        return body
    }
    it.each(['unauthenticated', 'manager', 'inactive', 'missing-profile', 'otp'])('denies %s before touching the body or allocating', async denial => {
        if (denial === 'unauthenticated') mocks.getUser.mockResolvedValue({ data: { user: null } })
        if (denial === 'manager') mocks.single.mockResolvedValue({ data: { role: 'manager', deleted_at: null } })
        if (denial === 'inactive') mocks.single.mockResolvedValue({ data: { role: 'analyst', deleted_at: '2026-11-04' } })
        if (denial === 'missing-profile') mocks.single.mockResolvedValue({ data: null })
        if (denial === 'otp') mocks.stepUp.mockResolvedValue(true)
        const req = request(), reader = vi.spyOn(req.body!, 'getReader')
        await safe(await post(req), denial === 'unauthenticated' ? 401 : 403)
        expect(reader).not.toHaveBeenCalled()
        expect(mocks.prepare).not.toHaveBeenCalled()
    })
    it('preserves the caller-bound confidential analyst OTP guard', async () => {
        await safe(await post(request()), 200)
        expect(mocks.stepUp).toHaveBeenCalledWith({ userId: batchId, role: 'analyst', can_access_confidential: true,
            sessionId: 'session-1', otpEmailUpdatedAt: 'version' }, expect.anything())
    })
    it('rejects foreign-origin cookie mutations before reading the body', async () => {
        const req = request(); req.headers.set('Origin', 'https://foreign.invalid')
        const reader = vi.spyOn(req.body!, 'getReader')
        await safe(await post(req), 403)
        expect(reader).not.toHaveBeenCalled()
        expect(mocks.prepare).not.toHaveBeenCalled()
    })
    it('admits exact source bytes and only the optional retry link', async () => {
        const data = form(); data.set('retryOfBatchId', batchId)
        expect(await safe(await post(request(data)), 200)).toEqual(result)
        expect(mocks.prepare).toHaveBeenCalledWith(new Uint8Array([80, 75, 3, 4]), batchId, expect.any(AbortSignal), expect.any(Number))
        expect(JSON.stringify(result)).not.toMatch(/sampleId|clientId|fingerprint/)
    })
    it.each(['owner', 'sourceHash', 'status', 'expiresAt', 'batchId', 'normalizedPayload', 'extraFile', 'duplicateFile', 'duplicateRetry', 'invalidRetry', 'textFile', 'emptyFile'])('rejects invalid envelope %s', async field => {
        const data = form()
        if (field === 'duplicateFile') data.append('file', new File(['x'], 'other.xlsx'))
        else if (field === 'duplicateRetry') { data.append('retryOfBatchId', batchId); data.append('retryOfBatchId', batchId) }
        else if (field === 'invalidRetry') data.set('retryOfBatchId', 'not-a-uuid')
        else if (field === 'textFile') data.set('file', 'RAW_WORKBOOK')
        else if (field === 'emptyFile') data.set('file', new File([], 'empty.xlsx'))
        else data.set(field, field === 'extraFile' ? new File(['x'], 'other.xlsx') : 'RAW_FORGERY')
        await safe(await post(request(data)), 400)
        expect(mocks.prepare).not.toHaveBeenCalled()
    })
    it('rejects the original file at the strict 10,000,000-byte limit', async () => {
        const data = new FormData(); data.set('file', new File([new Uint8Array(10000000)], 'large.xlsx'))
        await safe(await post(request(data)), 413)
        expect(mocks.prepare).not.toHaveBeenCalled()
    })
    it('admits a 9,999,999-byte file without applying the multipart limit to original file size', async () => {
        const data = new FormData(); data.set('file', new File([new Uint8Array(9999999)], 'allowed.xlsx'))
        await safe(await post(request(data)), 200)
        expect(mocks.prepare.mock.calls[0][0].byteLength).toBe(9999999)
    })
    it.each(['text/plain', 'multipart/form-data; boundary=missing'])('rejects unsupported or malformed multipart bodies: %s', async type => {
        const req = new Request('http://localhost/api/accession-preview', { method: 'POST', body: 'RAW_INVALID_BODY', headers: { 'Content-Type': type } })
        await safe(await post(req), 400)
        expect(mocks.prepare).not.toHaveBeenCalled()
    })
    it('stops consumption when the request disconnects while reading the body', async () => {
        const controller = new AbortController(), cancel = vi.fn()
        let entered!: () => void
        const reading = new Promise<void>(resolve => { entered = resolve })
        const req = new Request('http://localhost/api/accession-preview', { method: 'POST',
            body: new ReadableStream({ cancel }), signal: controller.signal,
            headers: { 'Content-Type': 'multipart/form-data; boundary=test' }, duplex: 'half' } as RequestInit)
        const getReader = req.body!.getReader.bind(req.body!)
        vi.spyOn(req.body!, 'getReader').mockImplementation(() => { entered(); return getReader() })
        const pending = post(req)
        await reading; controller.abort()
        await safe(await pending, 408)
        expect(cancel).toHaveBeenCalled()
        expect(mocks.prepare).not.toHaveBeenCalled()
    })
    it('applies the total deadline to a preparation transport that ignores cancellation', async () => {
        vi.useFakeTimers()
        mocks.prepare.mockImplementation(() => new Promise(() => {}))
        const pending = post(request())
        await vi.advanceTimersByTimeAsync(10001)
        await safe(await pending, 408)
        expect(mocks.prepare.mock.calls[0][2].aborted).toBe(true)
    })
    it('returns 408 when elapsed preparation fails before the queued abort timer runs', async () => {
        mocks.config.mockReturnValue({ policy: { request: { maxBytes: 10002000, maxResponseBytes: 100000, timeoutMs: 100 } } })
        mocks.prepare.mockImplementation(async (_source, _retry, signal: AbortSignal) => {
            await Promise.resolve() // Let the route attach its await before preparation blocks.
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150)
            expect(signal.aborted).toBe(false)
            throw new Error('RAW_PREPARATION_FAILURE')
        })
        await safe(await post(request()), 408)
        expect(mocks.prepare).toHaveBeenCalledOnce()
    })
    it.each([undefined, '1'])('bounds actual streamed bytes with untrusted Content-Length %s before native formData', async length => {
        const cancel = vi.fn(), parse = vi.spyOn(Request.prototype, 'formData')
        const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(10002001)) }, cancel })
        const req = new Request('http://localhost/api/accession-preview', { method: 'POST', body: stream,
            headers: { 'Content-Type': 'multipart/form-data; boundary=test', ...(length ? { 'Content-Length': length } : {}) }, duplex: 'half' } as RequestInit)
        await safe(await post(req), 413)
        expect(cancel).toHaveBeenCalled()
        expect(parse).not.toHaveBeenCalled()
        expect(mocks.prepare).not.toHaveBeenCalled()
        parse.mockRestore()
    })
    it('fails closed when measured configuration is unavailable without reading content', async () => {
        mocks.config.mockImplementation(() => { throw new Error('RAW_POLICY') })
        const req = request(), reader = vi.spyOn(req.body!, 'getReader')
        await safe(await post(req), 503)
        expect(reader).not.toHaveBeenCalled()
    })
    it('cancels a stalled body at the finite total deadline', async () => {
        vi.useFakeTimers()
        const cancel = vi.fn(), req = new Request('http://localhost/api/accession-preview', { method: 'POST',
            body: new ReadableStream({ cancel }), headers: { 'Content-Type': 'multipart/form-data; boundary=test' }, duplex: 'half' } as RequestInit)
        const pending = post(req)
        await vi.advanceTimersByTimeAsync(10001)
        await safe(await pending, 408)
        expect(cancel).toHaveBeenCalled()
        expect(mocks.prepare).not.toHaveBeenCalled()
    })
    it('cancels preparation on disconnect, passing a live signal downstream', async () => {
        const controller = new AbortController()
        let entered!: () => void
        const started = new Promise<void>(resolve => { entered = resolve })
        mocks.prepare.mockImplementation(() => { entered(); return new Promise(() => {}) })
        const pending = post(request(form(), controller.signal))
        const early = await Promise.race([started.then(() => null), pending])
        if (early) expect(early.status).toBe(200)
        controller.abort()
        expect(await safe(await pending, 408)).toEqual({ error: 'Yêu cầu đã bị hủy hoặc quá thời gian xử lý. Chưa thể xác nhận trạng thái xem trước.' })
        expect(mocks.prepare.mock.calls[0][2].aborted).toBe(true)
    })
    it('returns complete safe row failures and caps the whole response without truncating clients', async () => {
        mocks.prepare.mockResolvedValue({ ok: false, batchId, errors: [{ code: 'CATALOG_STALE', message: 'Danh mục đã thay đổi.', row: 2 }] })
        expect(await safe(await post(request()), 422)).toMatchObject({ ok: false, errors: [{ code: 'CATALOG_STALE' }] })
        mocks.prepare.mockResolvedValue({ ...result, clients: Array(10000).fill(result.clients[0]) })
        await safe(await post(request()), 503)
    })
    it('sanitizes ownership/allocation and unknown failures', async () => {
        mocks.prepare.mockRejectedValue(new Error('RAW_OTHER_OWNER_DATABASE'))
        await safe(await post(request()), 503)
    })
})
