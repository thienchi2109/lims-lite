// Source-level route boundary tests; no database or deployed download is exercised.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { signingFixture, snapshotFixture } from '@/lib/accession-template/test-fixtures'

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(), single: vi.fn(), rpc: vi.fn(), config: vi.fn(), generate: vi.fn(),
    from: vi.fn(), select: vi.fn(), eq: vi.fn(), stepUp: vi.fn(), getSession: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/manager-email-otp/guards', () => ({ shouldRequireManagerStepUp: mocks.stepUp }))
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: mocks.getUser, getSession: mocks.getSession }, from: mocks.from, rpc: mocks.rpc,
    }),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/accession-template/binding', async importOriginal => ({
    ...await importOriginal<typeof import('@/lib/accession-template/binding')>(),
    readTemplateSigningConfig: mocks.config,
}))
vi.mock('@/lib/accession-template/workbook', () => ({ generateAccessionTemplate: mocks.generate }))

import { GET } from './route'

describe('GET /api/accession/template', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        mocks.getUser.mockResolvedValue({ data: { user: { id: 'analyst-1' } }, error: null })
        mocks.getSession.mockResolvedValue({ data: { session: { access_token: `e30.${Buffer.from(JSON.stringify({ session_id: 'session-1' })).toString('base64url')}.synthetic` } } })
        mocks.stepUp.mockResolvedValue(false)
        mocks.from.mockReturnValue({ select: mocks.select })
        mocks.select.mockReturnValue({ eq: mocks.eq })
        mocks.eq.mockReturnValue({ single: mocks.single })
        mocks.single.mockResolvedValue({ data: { role: 'analyst', deleted_at: null }, error: null })
        mocks.rpc.mockResolvedValue({ data: { snapshot: 'synthetic' }, error: null })
        mocks.config.mockReturnValue({ synthetic: 'config' })
        mocks.generate.mockReturnValue(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    })

    async function expectSafeError(status: number, message: string) {
        const response = await GET()
        expect(response.status).toBe(status)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(response.headers.get('Content-Disposition')).toBeNull()
        expect(await response.json()).toEqual({ error: message })
    }

    it('returns binary XLSX with a server-selected attachment and no-store', async () => {
        const response = await GET()
        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="lims-tiep-nhan-mau-v1.xlsx"')
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
        expect(mocks.from).toHaveBeenCalledWith('users')
        expect(mocks.select).toHaveBeenCalledWith('role, deleted_at, can_access_confidential, manager_otp_settings(updated_at)')
        expect(mocks.eq).toHaveBeenCalledWith('id', 'analyst-1')
        expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_accession_template_snapshot')
        expect(mocks.generate).toHaveBeenCalledWith({ snapshot: 'synthetic' }, { synthetic: 'config' })
    })

    it('passes one caller-bound snapshot through the real signed workbook generator', async () => {
        const { generateAccessionTemplate } = await vi.importActual<typeof import('@/lib/accession-template/workbook')>('@/lib/accession-template/workbook')
        mocks.rpc.mockResolvedValue({ data: snapshotFixture(), error: null })
        mocks.config.mockReturnValue(signingFixture())
        mocks.generate.mockImplementation(generateAccessionTemplate)
        const response = await GET()
        expect(response.status).toBe(200)
        const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' })
        expect(workbook.SheetNames).toEqual(['Hướng dẫn', 'Thông tin template', 'Khách hàng', 'Mẫu', 'Chỉ định', 'Danh mục loại mẫu', 'Danh mục chỉ tiêu', 'Danh mục tương thích'])
        expect(mocks.rpc).toHaveBeenCalledOnce()
    })

    it.each([null, { id: 'analyst-1' }])('rejects missing/invalid authenticated identity before profile or snapshot', async user => {
        mocks.getUser.mockResolvedValue({ data: { user }, error: user ? { message: 'RAW_AUTH_SECRET' } : null })
        await expectSafeError(401, 'Vui lòng đăng nhập để tải template Excel.')
        expect(mocks.from).not.toHaveBeenCalled()
        expect(mocks.rpc).not.toHaveBeenCalled()
        expect(mocks.config).not.toHaveBeenCalled()
    })

    it.each([
        null,
        { role: 'manager', deleted_at: null },
        { role: 'doctor', deleted_at: null },
        { role: 'analyst', deleted_at: '2026-11-01T00:00:00Z' },
        { role: 'analyst' },
    ])('requires a current active analyst profile before snapshot: %j', async data => {
        mocks.single.mockResolvedValue({ data, error: null })
        await expectSafeError(403, 'Bạn không có quyền tải template Excel.')
        expect(mocks.rpc).not.toHaveBeenCalled()
        expect(mocks.generate).not.toHaveBeenCalled()
    })

    it('fails closed on profile lookup errors', async () => {
        mocks.single.mockResolvedValue({ data: { role: 'analyst', deleted_at: null }, error: { message: 'RAW_PROFILE' } })
        await expectSafeError(403, 'Bạn không có quyền tải template Excel.')
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('maps SQL authorization denial to a redacted Vietnamese error', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'RAW_RPC_SECRET' } })
        await expectSafeError(403, 'Bạn không có quyền tải template Excel.')
        expect(mocks.generate).not.toHaveBeenCalled()
    })

    it('honors the existing confidential analyst OTP guard before snapshot', async () => {
        mocks.single.mockResolvedValue({ data: { role: 'analyst', deleted_at: null, can_access_confidential: true, manager_otp_settings: [{ updated_at: 'synthetic-version' }] }, error: null })
        mocks.stepUp.mockResolvedValue(true)
        await expectSafeError(403, 'Vui lòng xác thực OTP email trước khi tải template Excel.')
        expect(mocks.stepUp).toHaveBeenCalledWith({
            userId: 'analyst-1', role: 'analyst', can_access_confidential: true,
            sessionId: 'session-1', otpEmailUpdatedAt: 'synthetic-version',
        }, expect.objectContaining({ get: expect.any(Function) }))
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it.each([false, true])('allows an active analyst after the existing OTP guard accepts (confidential=%s)', async canAccessConfidential => {
        mocks.single.mockResolvedValue({ data: { role: 'analyst', deleted_at: null, can_access_confidential: canAccessConfidential, manager_otp_settings: { updated_at: 'synthetic-version' } }, error: null })
        expect((await GET()).status).toBe(200)
        expect(mocks.stepUp).toHaveBeenCalledWith(expect.objectContaining({
            can_access_confidential: canAccessConfidential, sessionId: 'session-1', otpEmailUpdatedAt: 'synthetic-version',
        }), expect.anything())
        expect(mocks.rpc).toHaveBeenCalledOnce()
    })

    it.each(['P0001', 'PGRST202', '42883'])('fails closed when catalog/RPC is unavailable (%s)', async code => {
        mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'RAW_CATALOG' } })
        await expectSafeError(503, 'Chưa thể tải template Excel. Vui lòng thử lại sau.')
        expect(mocks.generate).not.toHaveBeenCalled()
    })

    it('does not issue a workbook with missing signing configuration', async () => {
        mocks.config.mockImplementation(() => { throw new Error('RAW_SIGNING_SECRET') })
        await expectSafeError(503, 'Chưa thể tải template Excel. Vui lòng thử lại sau.')
        expect(mocks.generate).not.toHaveBeenCalled()
    })

    it('redacts generation failures', async () => {
        mocks.generate.mockImplementation(() => { throw new Error('RAW_WORKBOOK_PAYLOAD') })
        await expectSafeError(503, 'Chưa thể tải template Excel. Vui lòng thử lại sau.')
    })
})
