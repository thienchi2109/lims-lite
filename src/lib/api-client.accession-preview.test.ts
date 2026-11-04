// @vitest-environment node
// Browser transport uses the same response/session rules as existing JSON mutations.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAccessionPreviewClient as create } from './api-client'
describe('accession preview FormData transport', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
    it('sends only the original file/retry via multipart and forwards cancellation', async () => {
        const payload = { ok: true, counts: { create: 1, reuse: 2 } }
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(payload))
        const file = new File(['original'], 'original.xlsx'), signal = new AbortController().signal
        await expect(create(file, 'retry-id', { signal })).resolves.toEqual(payload)
        expect(fetch).toHaveBeenCalledWith('/api/accession-preview', expect.objectContaining({ method: 'POST', credentials: 'include', signal }))
        const options = fetch.mock.calls[0][1]!
        expect(options.headers).toBeUndefined()
        const body = options.body as FormData
        expect([...body.keys()]).toEqual(['file', 'retryOfBatchId'])
        expect(await (body.get('file') as File).text()).toBe('original')
    })
    it('reuses expired-session redirect/error handling', async () => {
        const location = { href: '' }; vi.stubGlobal('window', { location })
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'raw' }, { status: 401 }))
        await expect(create(new File(['x'], 'x'))).rejects.toThrow('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
        expect(location.href).toBe('/login?reason=session_expired')
    })
    it('preserves complete structured row validation errors from a rejected preview', async () => {
        const body = { ok: false, batchId: '11111111-1111-4111-8111-111111111111', errors: [{
            code: 'CATALOG_STALE', message: 'Danh mục đã thay đổi.', sheet: 'Mẫu', row: 2,
            column: 'C', header: 'Loại mẫu', temporaryReference: 'M-01', relatedLocations: [],
        }] }
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status: 422 }))
        await expect(create(new File(['x'], 'x'))).resolves.toEqual(body)
    })
    it('fails closed on malformed rejected-preview payloads', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: false, batchId: 'forged', errors: [{ raw: 'ROW_SECRET' }] }, { status: 422 }))
        await expect(create(new File(['x'], 'x'))).rejects.toThrow('Không thể kết nối đến máy chủ')
    })
    it('preserves JSON mutation JWT-error redirect and safe HTTP errors', async () => {
        const location = { href: '' }; vi.stubGlobal('window', { location })
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'invalid JWT' }))
        await expect(create(new File(['x'], 'x'))).rejects.toThrow('Phiên đăng nhập không hợp lệ.')
        expect(location.href).toBe('/login?error=SessionExpired')
        fetch.mockResolvedValue(Response.json({ error: 'Tệp không hợp lệ.' }, { status: 400 }))
        await expect(create(new File(['x'], 'x'))).rejects.toThrow('Tệp không hợp lệ.')
    })
})
