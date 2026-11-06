// @vitest-environment node
// SOURCE ONLY: real multipart/session admission, mocked protected status and atomic adapter.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ user: vi.fn(), profile: vi.fn(), session: vi.fn(), stepUp: vi.fn(), status: vi.fn(), confirm: vi.fn(), config: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/manager-email-otp/guards', () => ({ shouldRequireManagerStepUp: mocks.stepUp }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.user, getSession: mocks.session },
    from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ single: mocks.profile }) }) }) }),
}) }))
vi.mock('@/lib/accession-preview/status', () => ({ getAccessionConfirmationStatus: mocks.status }))
vi.mock('@/lib/accession-preview/confirm', () => ({ confirmAccession: mocks.confirm }))
vi.mock('@/lib/accession-preview/server', () => ({ readPreviewConfiguration: mocks.config }))
const batchId = '11111111-1111-4111-8111-111111111111'
const receipt = { batch_id: batchId, owner_id: batchId, confirmation_received_at: '2026-11-06T01:00:00Z',
    client_count: 1, sample_count: 1, assignment_count: 1, create_count: 0, reuse_count: 1 }
const context = { params: Promise.resolve({ batchId }) }
async function invoke(req: Request, method: 'GET' | 'POST' = 'POST', ctx = context) { return (await import('./route'))[method](req, ctx) }
function form(size = 4) { const data = new FormData(); data.set('file', new File([new Uint8Array(size)], 'private-name.xlsx')); data.set('acceptableQuality', 'true'); return data }
function request(data: FormData | string = form(), signal?: AbortSignal) { return new Request(`http://localhost/api/accession-confirmation/${batchId}`, { method: 'POST', body: data, signal }) }
async function safe(res: Response, code: number) { expect(res.status).toBe(code); expect(res.headers.get('Cache-Control')).toBe('private, no-store'); const body = await res.json(); expect(JSON.stringify(body)).not.toMatch(/RAW_|private-name/); return body }

describe('authenticated confirmation HTTP bridge', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        mocks.user.mockResolvedValue({ data: { user: { id: batchId } } })
        mocks.profile.mockResolvedValue({ data: { role: 'analyst', deleted_at: null, can_access_confidential: true, manager_otp_settings: [{ updated_at: 'version' }] } })
        mocks.session.mockResolvedValue({ data: { session: { access_token: `e30.${Buffer.from(JSON.stringify({ session_id: 'session-1' })).toString('base64url')}.synthetic` } } })
        mocks.stepUp.mockResolvedValue(false)
        mocks.status.mockResolvedValue({ state: 'preview_ready', batchId })
        mocks.confirm.mockResolvedValue({ state: 'succeeded', receipt })
        mocks.config.mockReturnValue({ policy: { request: { maxBytes: 10002000, maxResponseBytes: 100000, timeoutMs: 10000 } } })
    })
    afterEach(() => vi.useRealTimers())
    it.each(['anonymous', 'manager', 'deleted', 'otp'])('denies %s before status/body', async kind => {
        if (kind === 'anonymous') mocks.user.mockResolvedValue({ data: { user: null } })
        if (kind === 'manager') mocks.profile.mockResolvedValue({ data: { role: 'manager', deleted_at: null } })
        if (kind === 'deleted') mocks.profile.mockResolvedValue({ data: { role: 'analyst', deleted_at: '2026-11-06' } })
        if (kind === 'otp') mocks.stepUp.mockResolvedValue(true)
        const req = request(), reader = vi.spyOn(req.body!, 'getReader')
        await safe(await invoke(req), kind === 'anonymous' ? 401 : 403)
        expect(reader).not.toHaveBeenCalled(); expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it('rejects foreign origin and malformed UUID before body/status', async () => {
        const req = request(); req.headers.set('Origin', 'https://foreign.invalid')
        await safe(await invoke(req), 403)
        await safe(await invoke(request(), 'POST', { params: Promise.resolve({ batchId: 'invalid' }) }), 400)
        expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it('retains caller-bound existing confidential OTP/session check', async () => {
        await safe(await invoke(request()), 200)
        expect(mocks.stepUp).toHaveBeenCalledWith({ userId: batchId, role: 'analyst', can_access_confidential: true,
            sessionId: 'session-1', otpEmailUpdatedAt: 'version' }, expect.anything())
    })
    it.each(['processing', 'unknown', 'failed', 'expired', 'rejected', 'preparing'])('returns preflight %s without body or dispatch', async state => {
        mocks.status.mockResolvedValue({ state, batchId })
        const req = request(), reader = vi.spyOn(req.body!, 'getReader')
        expect((await safe(await invoke(req), state === 'unknown' ? 503 : state === 'processing' || state === 'preparing' ? 202 : 422)).state).toBe(state)
        expect(reader).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it('returns committed receipt body-free without confirmation config', async () => {
        mocks.status.mockResolvedValue({ state: 'succeeded', receipt }); mocks.config.mockImplementation(() => { throw new Error('RAW_POLICY') })
        expect(await safe(await invoke(request('ignored')), 200)).toEqual({ state: 'succeeded', receipt })
        expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.config).not.toHaveBeenCalled()
    })
    it('supports GET without source/config and checks protected ownership before body', async () => {
        mocks.status.mockResolvedValue({ state: 'succeeded', receipt })
        expect(await safe(await invoke(new Request(`http://localhost/api/accession-confirmation/${batchId}`), 'GET'), 200)).toEqual({ state: 'succeeded', receipt })
        expect(mocks.config).not.toHaveBeenCalled()
        mocks.status.mockRejectedValue(new Error('ACCESSION_CONFIRMATION_FORBIDDEN'))
        const req = request(), reader = vi.spyOn(req.body!, 'getReader')
        await safe(await invoke(req), 403); expect(reader).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it('passes only exact bytes and true to the existing adapter once', async () => {
        await safe(await invoke(request()), 200)
        expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(batchId, new Uint8Array(4), true)
    })
    it('fails closed before body when fresh-confirmation policy is missing', async () => {
        mocks.config.mockImplementation(() => { throw new Error('RAW_POLICY') })
        const req = request(), reader = vi.spyOn(req.body!, 'getReader')
        await safe(await invoke(req), 503); expect(reader).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it('counts preflight elapsed time in the existing request deadline', async () => {
        mocks.config.mockReturnValue({ policy: { request: { maxBytes: 10002000, maxResponseBytes: 100000, timeoutMs: 100 } } })
        mocks.status.mockImplementation(async () => {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150)
            return { state: 'preview_ready', batchId }
        })
        const req = request(), reader = vi.spyOn(req.body!, 'getReader')
        await safe(await invoke(req), 408); expect(reader).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it.each([9999999, 10000000, 10000001])('enforces original decimal-byte ceiling at %i', async size => {
        await safe(await invoke(request(form(size))), size < 10000000 ? 200 : 413)
        if (size < 10000000) expect(mocks.confirm.mock.calls[0][1].length).toBe(size)
        else expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it.each(['missing', 'false', 'TRUE', 'duplicate', 'actor', 'normalizedPayload', 'file', 'empty'])('rejects malformed authority/attestation: %s', async bad => {
        const data = form()
        if (bad === 'missing') data.delete('acceptableQuality')
        else if (['false', 'TRUE'].includes(bad)) data.set('acceptableQuality', bad)
        else if (bad === 'duplicate') data.append('acceptableQuality', 'true')
        else if (bad === 'file') data.append('file', new File(['x'], 'x.xlsx'))
        else if (bad === 'empty') data.set('file', new File([], 'x.xlsx'))
        else data.set(bad, 'RAW_AUTHORITY')
        await safe(await invoke(request(data)), 400); expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it('rejects malformed multipart and actual streamed envelope overflow before parsing', async () => {
        await safe(await invoke(request('RAW_BODY')), 400)
        const cancel = vi.fn(), parse = vi.spyOn(Request.prototype, 'formData')
        const req = new Request(`http://localhost/api/accession-confirmation/${batchId}`, { method: 'POST',
            body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(10002001)) }, cancel }),
            headers: { 'Content-Type': 'multipart/form-data; boundary=test', 'Content-Length': '1' }, duplex: 'half' } as RequestInit)
        await safe(await invoke(req), 413); expect(cancel).toHaveBeenCalled(); expect(parse).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled(); parse.mockRestore()
    })
    it('cancels admission before dispatch', async () => {
        await import('./route')
        const controller = new AbortController(), cancel = vi.fn(); let reading!: () => void
        const entered = new Promise<void>(r => { reading = r })
        const req = new Request(`http://localhost/api/accession-confirmation/${batchId}`, { method: 'POST',
            body: new ReadableStream({ cancel }), signal: controller.signal,
            headers: { 'Content-Type': 'multipart/form-data; boundary=test' }, duplex: 'half' } as RequestInit)
        const reader = req.body!.getReader.bind(req.body!)
        vi.spyOn(req.body!, 'getReader').mockImplementation(() => { reading(); return reader() })
        const pending = invoke(req); await entered; controller.abort()
        await safe(await pending, 408); expect(cancel).toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled()
    })
    it('does not propagate disconnect to dispatched atomic work or replay', async () => {
        await import('./route')
        const controller = new AbortController(); let dispatch!: () => void, finish!: (value: unknown) => void
        const entered = new Promise<void>(r => { dispatch = r })
        mocks.confirm.mockImplementation(() => { dispatch(); return new Promise(r => { finish = r }) })
        const pending = invoke(request(form(), controller.signal)); await entered; controller.abort()
        finish({ state: 'succeeded', receipt })
        expect((await safe(await pending, 200)).state).toBe('succeeded')
        expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(batchId, new Uint8Array(4), true)
    })
    it('reports unknown when dispatched RPC exceeds HTTP deadline without cancel/retry', async () => {
        vi.useFakeTimers(); mocks.confirm.mockImplementation(() => new Promise(() => {}))
        const pending = invoke(request()); await vi.advanceTimersByTimeAsync(10001)
        expect((await safe(await pending, 503)).state).toBe('unknown'); expect(mocks.confirm).toHaveBeenCalledOnce()
    })
    it('preserves adapter changed-source failure and transport uncertainty safely', async () => {
        mocks.confirm.mockResolvedValue({ state: 'failed', batchId, reasonCode: 'PREVIEW_CONTENT_CHANGED' })
        expect((await safe(await invoke(request()), 422)).reasonCode).toBe('PREVIEW_CONTENT_CHANGED')
        mocks.confirm.mockRejectedValue(new Error('RAW_DATABASE_SECRET'))
        expect((await safe(await invoke(request()), 503)).state).toBe('unknown')
    })
})
