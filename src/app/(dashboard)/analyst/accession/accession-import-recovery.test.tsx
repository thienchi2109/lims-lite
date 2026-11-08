// Phase 3 source interactions: status/retry clients are mocked, never runtime/security acceptance.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn(), samples: vi.fn(), status: vi.fn(), retry: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ createAccessionPreviewClient: mocks.preview, confirmAccessionClient: mocks.confirm,
    fetchAccessionReceiptSamplesClient: mocks.samples, fetchAccessionConfirmationStatusClient: mocks.status,
    retryAccessionPreviewClient: mocks.retry }))
vi.mock('@/components/walkthrough', () => ({ WalkthroughTrigger: () => <button>Hướng dẫn</button> }))
import { AccessionPageHeader } from './accession-page-header'
import { AuthenticatedQueryBoundary } from '@/components/auth/authenticated-query-boundary'

const batchId = '11111111-1111-4111-8111-111111111111'
const nextBatchId = '22222222-2222-4222-8222-222222222222'
const sampleId = '33333333-3333-4333-8333-333333333333'
const attestation = 'Tôi xác nhận tất cả mẫu đã được lấy và đạt chất lượng.'
const profile = { name: 'KHÔNG LƯU HỒ SƠ', dateOfBirth: '1990-01-02', governmentIdentityType: null,
    governmentIdentityValue: null, gender: 'Nam', phone: '0912345678', address: null, healthInsuranceNum: null, expiryDate: null }
function preview(id = batchId) { return { ok: true, batchId: id, previewCreatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(), counts: { clients: 1, samples: 1, assignments: 1, create: 1, reuse: 0 },
    clients: [{ row: 2, disposition: 'create', input: profile, existingValues: null, unchangedFields: [] }] } }
const receipt = { batch_id: batchId, owner_id: batchId, confirmation_received_at: '2026-11-08T00:00:00.000Z',
    client_count: 1, sample_count: 1, assignment_count: 1, create_count: 1, reuse_count: 0 }
const success = { state: 'succeeded', receipt }
const ids = { batchId, samples: [{ row: 2, sampleId, officialSampleIdentifier: 'CDC-2026-000042' }] }
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function open() {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const rendered = render(<QueryClientProvider client={queryClient}><AccessionPageHeader /></QueryClientProvider>)
    const trigger = screen.getByRole('button', { name: 'Nhập từ Excel' })
    await user.click(trigger)
    return { user, trigger, ...rendered }
}
async function upload(user: ReturnType<typeof userEvent.setup>, name = 'KHONG-LUU-TEP.xlsx') {
    const file = new File(['EXACT_ORIGINAL_BYTES'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await user.upload(screen.getByLabelText('Tệp Excel'), file)
    await user.click(screen.getByRole('button', { name: 'Xem trước' }))
    return file
}
async function uncertain(user: ReturnType<typeof userEvent.setup>) {
    await upload(user)
    await user.click(await screen.findByRole('checkbox', { name: attestation }))
    await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
    await screen.findByText(/Chưa rõ kết quả xác nhận/)
}
async function lookup(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('button', { name: 'Tra cứu trạng thái' })) }

beforeEach(() => {
    vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear()
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    mocks.preview.mockImplementation(async () => preview())
    mocks.confirm.mockResolvedValue({ state: 'unknown', batchId })
    mocks.status.mockResolvedValue(success)
    mocks.samples.mockResolvedValue(ids)
    mocks.retry.mockImplementation(async () => preview(nextBatchId))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear() })

describe('accession status-first recovery', () => {
    it.each(['during', 'after'])('retains the original ID read when it resolves %s an unknown lookup', async timing => {
        const pendingIds = deferred(); const pendingStatus = deferred()
        mocks.confirm.mockResolvedValue(success); mocks.samples.mockReturnValue(pendingIds.promise)
        mocks.status.mockReturnValue(pendingStatus.promise)
        const { user } = await open(); await upload(user)
        await user.click(await screen.findByRole('checkbox', { name: attestation }))
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByRole('heading', { name: 'Đã nhập thành công' }); await lookup(user)
        if (timing === 'after') {
            await act(async () => { pendingStatus.resolve({ state: 'unknown', batchId }) })
            await waitFor(() => expect(screen.getByRole('button', { name: 'Tra cứu trạng thái' }).hasAttribute('disabled')).toBe(false))
        }
        await act(async () => { pendingIds.resolve(ids) })
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        if (timing === 'during') await act(async () => { pendingStatus.resolve({ state: 'unknown', batchId }) })
        expect(screen.getByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.samples).toHaveBeenCalledOnce()
    })

    it('preserves a committed receipt and IDs when manual status resolves unknown', async () => {
        mocks.confirm.mockResolvedValue(success)
        const { user } = await open(); await upload(user)
        await user.click(await screen.findByRole('checkbox', { name: attestation }))
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByText('CDC-2026-000042')
        mocks.status.mockResolvedValue({ state: 'unknown', batchId })
        await lookup(user)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Tra cứu trạng thái' }).hasAttribute('disabled')).toBe(false))
        expect(screen.getByRole('heading', { name: 'Đã nhập thành công' })).toBeTruthy()
        expect(screen.getByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.samples).toHaveBeenCalledOnce()
    })

    it('announces manual lookup through live status text while retaining the committed receipt', async () => {
        mocks.confirm.mockResolvedValue(success)
        const { user } = await open(); await upload(user)
        await user.click(await screen.findByRole('checkbox', { name: attestation }))
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByText('CDC-2026-000042')
        const pending = deferred(); mocks.status.mockReturnValue(pending.promise)
        await lookup(user)
        expect(screen.getByRole('status').textContent).toMatch(/Đang tra cứu/)
        expect(screen.getByRole('heading', { name: 'Đã nhập thành công' })).toBeTruthy()
        await act(async () => { pending.resolve(success) })
    })

    it('rejects status-shaped success from the ordinary initial preview boundary', async () => {
        mocks.preview.mockResolvedValue(success)
        const { user } = await open(); await upload(user)
        expect((await screen.findByRole('alert')).textContent).toMatch(/chưa thể xem trước/i)
        expect(screen.queryByRole('heading', { name: 'Đã nhập thành công' })).toBeNull()
        expect(mocks.samples).not.toHaveBeenCalled()
        expect(sessionStorage.length).toBe(0)
    })

    it.each([
        ['malformed', { state: 'unknown', batchId: '../private.xlsx' }],
        ['wrong-parent', { state: 'succeeded', receipt: { ...receipt, batch_id: nextBatchId } }],
    ])('rejects %s status-shaped result from the linked retry boundary', async (_name, response) => {
        mocks.status.mockResolvedValue({ state: 'preview_ready', batchId })
        const { user } = await open(); await uncertain(user); await lookup(user)
        await user.click(await screen.findByRole('button', { name: 'Tạo lần xem trước mới' }))
        mocks.retry.mockResolvedValue(response)
        await upload(user)
        expect((await screen.findByRole('alert')).textContent).toMatch(/chưa thể xem trước/i)
        expect(screen.queryByRole('heading', { name: 'Đã nhập thành công' })).toBeNull()
        expect(mocks.samples).not.toHaveBeenCalled()
        expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe(batchId)
    })

    it('looks up unknown before showing committed success without confirming or uploading again', async () => {
        const { user } = await open(); await uncertain(user)
        await lookup(user)
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.status).toHaveBeenCalledExactlyOnceWith(batchId)
        expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.preview).toHaveBeenCalledOnce()
        expect(mocks.retry).not.toHaveBeenCalled()
    })

    it.each(['preparing', 'processing', 'unknown'])('keeps %s unresolved with no replay/upload/new attempt', async state => {
        mocks.status.mockResolvedValue({ state, batchId })
        const { user } = await open(); await uncertain(user); await lookup(user)
        await waitFor(() => expect(mocks.status).toHaveBeenCalledOnce())
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        expect(screen.queryByRole('button', { name: 'Tạo lần xem trước mới' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Xác nhận nhập' })).toBeNull()
        expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.retry).not.toHaveBeenCalled()
    })

    it('announces lookup pending and prevents double-click lookup without polling', async () => {
        const pending = deferred(); mocks.status.mockReturnValue(pending.promise)
        const { user } = await open(); await uncertain(user)
        await user.dblClick(screen.getByRole('button', { name: 'Tra cứu trạng thái' }))
        expect(screen.getByRole('button', { name: 'Đang tra cứu…' }).getAttribute('aria-busy')).toBe('true')
        expect(mocks.status).toHaveBeenCalledOnce()
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        await act(async () => { pending.resolve({ state: 'processing', batchId }) })
        expect(mocks.status).toHaveBeenCalledOnce()
    })

    it('retains unknown after lookup transport failure and lets the analyst request another lookup', async () => {
        mocks.status.mockRejectedValueOnce(new Error('RAW_TRANSPORT')).mockResolvedValueOnce(success)
        const { user } = await open(); await uncertain(user); await lookup(user)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Tra cứu trạng thái' }).hasAttribute('disabled')).toBe(false))
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        expect(screen.queryByText('RAW_TRANSPORT')).toBeNull()
        await lookup(user)
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.confirm).toHaveBeenCalledOnce()
    })

    it('persists only a raw UUID locator and recovers success after refresh with no source file', async () => {
        const first = await open(); await uncertain(first.user)
        expect(sessionStorage.length).toBe(1)
        expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe(batchId)
        expect(localStorage.length).toBe(0)
        first.unmount()
        const second = await open()
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        expect(screen.queryByText('KHÔNG LƯU HỒ SƠ')).toBeNull()
        await lookup(second.user)
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.preview).toHaveBeenCalledOnce()
    })

    it('rejects a malformed stored locator before requesting status', async () => {
        const first = await open(); await uncertain(first.user)
        const key = sessionStorage.key(0)!
        first.unmount(); sessionStorage.setItem(key, '../private-workbook.xlsx')
        await open()
        expect(screen.getByLabelText('Tệp Excel')).toBeTruthy()
        expect(mocks.status).not.toHaveBeenCalled()
        expect(sessionStorage.getItem(key)).toBeNull()
    })

    it('storage failure cannot release an in-memory unknown guard', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('STORAGE_DENIED') })
        const { user, trigger } = await open(); await uncertain(user)
        await user.keyboard('{Escape}'); await user.click(trigger)
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        await lookup(user)
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.confirm).toHaveBeenCalledOnce()
    })

    it.each(['preview_ready', 'failed', 'rejected', 'expired'])(
        'requires an explicit linked new preview after file loss and %s status', async state => {
            const first = await open(); await upload(first.user); await screen.findByRole('heading', { name: 'Kết quả xem trước' })
            first.unmount(); mocks.status.mockResolvedValue({ state, batchId })
            const second = await open(); await lookup(second.user)
            expect(screen.queryByRole('checkbox', { name: attestation })).toBeNull()
            await second.user.click(await screen.findByRole('button', { name: 'Tạo lần xem trước mới' }))
            const file = await upload(second.user, 'CHON-LAI.xlsx')
            await screen.findByRole('checkbox', { name: attestation })
            expect(mocks.retry).toHaveBeenCalledExactlyOnceWith(batchId, file, { signal: expect.any(AbortSignal) })
            expect(mocks.confirm).not.toHaveBeenCalled()
            expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe(nextBatchId)
            expect(mocks.preview).toHaveBeenCalledOnce()
        })

    it.each(['processing', 'unknown', 'succeeded'])(
        'respects a %s result from the retry client recheck without dispatching a browser replay', async state => {
            const first = await open(); await uncertain(first.user)
            mocks.status.mockResolvedValue({ state: 'preview_ready', batchId }); await lookup(first.user)
            await first.user.click(await screen.findByRole('button', { name: 'Tạo lần xem trước mới' }))
            mocks.retry.mockResolvedValue(state === 'succeeded' ? success : { state, batchId })
            await upload(first.user, 'THU-LAI.xlsx')
            await waitFor(() => expect(screen.queryByLabelText('Tệp Excel')).toBeNull())
            if (state === 'succeeded') expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
            expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.preview).toHaveBeenCalledOnce()
        })

    it('can look up a committed receipt again after the separate ID read failed', async () => {
        mocks.confirm.mockResolvedValue(success); mocks.samples.mockRejectedValueOnce(new Error('RAW_IDS')).mockResolvedValueOnce(ids)
        const { user } = await open(); await upload(user)
        await user.click(await screen.findByRole('checkbox', { name: attestation }))
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByRole('alert'); await lookup(user)
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.samples).toHaveBeenCalledTimes(2)
    })

    it('clears a denied locator/private state and never exposes another owner receipt', async () => {
        const { user } = await open(); await uncertain(user)
        mocks.status.mockRejectedValue(new Error('Bạn không có quyền truy cập lần nhập này.'))
        await lookup(user)
        expect((await screen.findByRole('alert')).textContent).toMatch(/đăng nhập.*quyền/i)
        expect(sessionStorage.length).toBe(0)
        expect(screen.queryByText(batchId)).toBeNull()
        expect(mocks.samples).not.toHaveBeenCalled()
    })

    it('ignores status results after the owning component is unmounted', async () => {
        const pending = deferred(); mocks.status.mockReturnValue(pending.promise)
        const first = await open(); await uncertain(first.user); await lookup(first.user)
        first.unmount()
        await open()
        await act(async () => { pending.resolve(success) })
        expect(screen.queryByText('CDC-2026-000042')).toBeNull()
        expect(mocks.samples).not.toHaveBeenCalled()
    })

    it('clears private receipt and IDs if access is revoked at the ID-read boundary', async () => {
        mocks.confirm.mockResolvedValue(success)
        mocks.samples.mockRejectedValue(new Error('Bạn không có quyền truy cập lần nhập này.'))
        const { user } = await open(); await upload(user)
        await user.click(await screen.findByRole('checkbox', { name: attestation }))
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        expect((await screen.findByRole('alert')).textContent).toMatch(/đăng nhập.*quyền/i)
        expect(screen.queryByRole('heading', { name: 'Đã nhập thành công' })).toBeNull()
        expect(screen.queryByText(batchId)).toBeNull()
        expect(sessionStorage.length).toBe(0)
    })

    it('does not restore late IDs after a status lookup withdraws the current role', async () => {
        const pending = deferred(); mocks.confirm.mockResolvedValue(success); mocks.samples.mockReturnValue(pending.promise)
        const { user } = await open(); await upload(user)
        await user.click(await screen.findByRole('checkbox', { name: attestation }))
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByRole('heading', { name: 'Đã nhập thành công' })
        mocks.status.mockRejectedValue(new Error('Bạn không có quyền truy cập lần nhập này.'))
        await lookup(user); await screen.findByRole('alert')
        await act(async () => { pending.resolve(ids) })
        expect(screen.queryByText('CDC-2026-000042')).toBeNull()
        expect(screen.queryByText(batchId)).toBeNull()
    })

    it.each(['different-actor', 'withdrawn-role'])('reauthorizes a saved locator after the existing principal boundary changes to %s', async nextPrincipal => {
        const user = userEvent.setup()
        const view = (principalKey: string) => <AuthenticatedQueryBoundary principalKey={principalKey}><AccessionPageHeader /></AuthenticatedQueryBoundary>
        const rendered = render(view('owner-analyst'))
        await user.click(screen.getByRole('button', { name: 'Nhập từ Excel' }))
        mocks.confirm.mockResolvedValue(success)
        const pending = deferred(); mocks.samples.mockReturnValue(pending.promise)
        await upload(user); await user.click(await screen.findByRole('checkbox', { name: attestation }))
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByRole('heading', { name: 'Đã nhập thành công' })
        rendered.rerender(view(nextPrincipal))
        expect(screen.queryByRole('heading', { name: 'Đã nhập thành công' })).toBeNull()
        mocks.status.mockRejectedValue(new Error('Bạn không có quyền truy cập lần nhập này.'))
        await user.click(screen.getByRole('button', { name: 'Nhập từ Excel' })); await lookup(user)
        await screen.findByRole('alert')
        await act(async () => { pending.resolve(ids) })
        expect(screen.queryByText('CDC-2026-000042')).toBeNull()
        expect(screen.queryByText(batchId)).toBeNull()
        expect(sessionStorage.length).toBe(0)
    })

    it('ignores old-principal status results after the real authenticated boundary remounts', async () => {
        const user = userEvent.setup(), pending = deferred()
        const view = (principalKey: string) => <AuthenticatedQueryBoundary principalKey={principalKey}><AccessionPageHeader /></AuthenticatedQueryBoundary>
        const rendered = render(view('actor-a'))
        await user.click(screen.getByRole('button', { name: 'Nhập từ Excel' })); await uncertain(user)
        mocks.status.mockReturnValue(pending.promise); await lookup(user)
        rendered.rerender(view('actor-b'))
        await user.click(screen.getByRole('button', { name: 'Nhập từ Excel' }))
        await act(async () => { pending.resolve(success) })
        expect(screen.queryByText('CDC-2026-000042')).toBeNull()
        expect(screen.queryByRole('heading', { name: 'Đã nhập thành công' })).toBeNull()
        expect(mocks.samples).not.toHaveBeenCalled()
    })

    it('stores only the authorized rejected-preview batch locator before any confirmation', async () => {
        mocks.preview.mockResolvedValue({ ok: false, batchId, errors: [{ sheet: 'Mẫu', row: 2, column: 'C',
            header: 'Mã loại mẫu', temporaryReference: 'KHONG-LUU-MA-TAM', code: 'CATALOG_STALE', message: 'Tải template mới.' }] })
        const { user } = await open(); await upload(user)
        await screen.findByRole('table', { name: 'Lỗi cần sửa trong Excel' })
        expect(sessionStorage.length).toBe(1)
        expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe(batchId)
        expect(mocks.confirm).not.toHaveBeenCalled()
    })
})
