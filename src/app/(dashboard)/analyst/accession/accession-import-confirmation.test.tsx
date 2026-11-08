// Phase 2 source interactions; mocked confirmation/ID reads are not runtime acceptance.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleKeys, searchKeys } from '@/types/query-keys'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn(), samples: vi.fn(), status: vi.fn(), retry: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ createAccessionPreviewClient: mocks.preview,
    confirmAccessionClient: mocks.confirm, fetchAccessionReceiptSamplesClient: mocks.samples,
    fetchAccessionConfirmationStatusClient: mocks.status, retryAccessionPreviewClient: mocks.retry }))
vi.mock('@/components/walkthrough', () => ({ WalkthroughTrigger: () => <button>Hướng dẫn</button> }))
import { AccessionPageHeader } from './accession-page-header'

const batchId = '11111111-1111-4111-8111-111111111111'
const sampleId = '22222222-2222-4222-8222-222222222222'
const attestation = 'Tôi xác nhận tất cả mẫu đã được lấy và đạt chất lượng.'
const profile = { name: 'Khách tổng hợp', dateOfBirth: '1990-01-02', governmentIdentityType: null,
    governmentIdentityValue: null, gender: 'Nam', phone: '0912345678', address: null, healthInsuranceNum: null, expiryDate: null }
function preview() { return { ok: true, batchId, previewCreatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(), counts: { clients: 1, samples: 1, assignments: 2, create: 1, reuse: 0 },
    clients: [{ row: 2, disposition: 'create', input: profile, existingValues: null, unchangedFields: [] }] } }
const receipt = { batch_id: batchId, owner_id: batchId, confirmation_received_at: '2026-11-07T11:00:00.000Z',
    client_count: 1, sample_count: 1, assignment_count: 2, create_count: 1, reuse_count: 0 }
const succeeded = { state: 'succeeded', receipt }
const sampleResponse = { batchId, samples: [{ row: 2, sampleId, officialSampleIdentifier: 'CDC-2026-000042' }] }
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function open() {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const rendered = render(<QueryClientProvider client={queryClient}><AccessionPageHeader /></QueryClientProvider>)
    const trigger = screen.getByRole('button', { name: 'Nhập từ Excel' })
    await user.click(trigger)
    return { user, queryClient, invalidate, trigger, ...rendered }
}
async function prepare(user: ReturnType<typeof userEvent.setup>, name = 'goc.xlsx') {
    const file = new File(['EXACT_ORIGINAL_BYTES'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await user.upload(screen.getByLabelText('Tệp Excel'), file)
    await user.click(screen.getByRole('button', { name: 'Xem trước' }))
    await screen.findByRole('heading', { name: 'Kết quả xem trước' })
    return file
}
async function attest(user: ReturnType<typeof userEvent.setup>) { await user.click(screen.getByRole('checkbox', { name: attestation })) }

beforeEach(() => {
    sessionStorage.clear()
    vi.resetAllMocks()
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    mocks.preview.mockImplementation(async () => preview())
    mocks.confirm.mockResolvedValue(succeeded)
    mocks.samples.mockResolvedValue(sampleResponse)
    mocks.status.mockResolvedValue(succeeded)
    mocks.retry.mockImplementation((_batchId, file, options) => mocks.preview(file, undefined, options))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })

describe('accession immutable preview confirmation', () => {
    it('requires initially unchecked accessible quality attestation and confirms exact original File once', async () => {
        const pending = deferred(); mocks.confirm.mockReturnValue(pending.promise)
        const { user, invalidate } = await open()
        const file = await prepare(user)
        const checkbox = screen.getByRole('checkbox', { name: attestation })
        const confirm = screen.getByRole('button', { name: 'Xác nhận nhập' })
        expect(checkbox.getAttribute('aria-checked')).toBe('false')
        expect(confirm.hasAttribute('disabled')).toBe(true)
        checkbox.focus(); await user.keyboard(' ')
        expect(checkbox.getAttribute('aria-checked')).toBe('true')
        await user.dblClick(confirm)
        expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(batchId, file, true)
        expect(screen.getByRole('button', { name: 'Đang xác nhận…' }).getAttribute('aria-busy')).toBe('true')
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        expect(invalidate).not.toHaveBeenCalled()
        await act(async () => { pending.resolve(succeeded) })
        await screen.findByRole('heading', { name: 'Đã nhập thành công' })
    })

    it('clears attestation and preview on file replacement and requires a fresh preview', async () => {
        const { user } = await open(); await prepare(user); await attest(user)
        await user.upload(screen.getByLabelText('Tệp Excel'), new File(['CHANGED'], 'khac.xlsx'))
        expect(screen.queryByRole('checkbox', { name: attestation })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Xác nhận nhập' })).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        expect((await screen.findByRole('checkbox', { name: attestation })).getAttribute('aria-checked')).toBe('false')
        expect(mocks.confirm).not.toHaveBeenCalled()
    })

    it('rejects already expired server preview without confirmation', async () => {
        mocks.preview.mockResolvedValue({ ...preview(), expiresAt: new Date(Date.now() - 1).toISOString() })
        const { user } = await open()
        const file = new File(['old'], 'het-han.xlsx')
        await user.upload(screen.getByLabelText('Tệp Excel'), file)
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        expect((await screen.findByRole('alert')).textContent).toMatch(/hết hạn.*xem trước mới/i)
        expect(screen.queryByRole('checkbox', { name: attestation })).toBeNull()
        expect(mocks.confirm).not.toHaveBeenCalled()
    })

    it('expires an attested preview while the dialog remains open', async () => {
        mocks.preview.mockResolvedValue({ ...preview(), expiresAt: new Date(Date.now() + 1000).toISOString() })
        const { user } = await open(); await prepare(user); await attest(user)
        await waitFor(() => expect(screen.queryByRole('checkbox', { name: attestation })).toBeNull(), { timeout: 2000 })
        expect(screen.getByRole('alert').textContent).toMatch(/hết hạn.*xem trước mới/i)
        expect(mocks.confirm).not.toHaveBeenCalled()
    })

    it.each(['EXPIRED', 'AUTHORITY_CHANGED', 'PREVIEW_CONTENT_CHANGED'])(
        'invalidates preview and attestation after server %s without replay', async reasonCode => {
            mocks.confirm.mockResolvedValue({ state: reasonCode === 'EXPIRED' ? 'expired' : 'rejected', batchId, reasonCode })
            const { user, invalidate } = await open(); await prepare(user); await attest(user)
            await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
            expect((await screen.findByRole('alert')).textContent).toMatch(/xem trước mới/i)
            expect(screen.queryByRole('checkbox', { name: attestation })).toBeNull()
            expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.samples).not.toHaveBeenCalled()
            expect(invalidate).not.toHaveBeenCalled()
        })

    it('clears private preview on role/session denial and gives fresh-preview guidance', async () => {
        mocks.confirm.mockRejectedValue(new Error('Bạn không có quyền truy cập lần nhập này.'))
        const { user, invalidate } = await open(); await prepare(user); await attest(user)
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        expect((await screen.findByRole('alert')).textContent).toMatch(/đăng nhập.*quyền.*xem trước mới/i)
        expect(screen.queryByText('Khách tổng hợp')).toBeNull()
        expect(screen.queryByRole('checkbox')).toBeNull()
        expect(invalidate).not.toHaveBeenCalled()
    })

    it('shows committed receipt and official IDs, refreshes existing sample queries only after success', async () => {
        const { user, invalidate } = await open(); await prepare(user); await attest(user)
        expect(invalidate).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByRole('heading', { name: 'Đã nhập thành công' })
        expect(screen.getByText(batchId)).toBeTruthy()
        expect(screen.getByText(/Thời điểm xác nhận/)).toBeTruthy()
        expect(screen.getByText('1 mẫu')).toBeTruthy()
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.samples).toHaveBeenCalledExactlyOnceWith(batchId)
        expect(invalidate).toHaveBeenCalledWith({ queryKey: sampleKeys.all })
        expect(invalidate).toHaveBeenCalledWith({ queryKey: searchKeys.all })
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        expect(screen.queryByText('Khách tổng hợp')).toBeNull()
    })

    it('keeps successful receipt when the separate official-ID read fails, without replay', async () => {
        mocks.samples.mockRejectedValue(new Error('RAW_ID_READ'))
        const { user, invalidate } = await open(); await prepare(user); await attest(user)
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByRole('heading', { name: 'Đã nhập thành công' })
        expect((await screen.findByRole('alert')).textContent).toMatch(/đã nhập thành công.*chưa thể tải mã mẫu/i)
        expect(screen.queryByText('RAW_ID_READ')).toBeNull()
        expect(mocks.confirm).toHaveBeenCalledOnce()
        expect(invalidate).toHaveBeenCalledWith({ queryKey: sampleKeys.all })
        expect(invalidate).toHaveBeenCalledWith({ queryKey: searchKeys.all })
    })

    it.each(['unknown', 'processing', 'preparing'])(
        'preserves %s guard across keyboard close/reopen and blocks all new uploads', async state => {
            mocks.confirm.mockResolvedValue({ state, batchId })
            const { user, trigger, invalidate } = await open(); await prepare(user); await attest(user)
            await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
            await waitFor(() => expect(screen.queryByLabelText('Tệp Excel')).toBeNull())
            expect(screen.getByRole('status').textContent).toMatch(/chưa rõ|đang xác nhận/i)
            expect(screen.queryByRole('button', { name: 'Xác nhận nhập' })).toBeNull()
            await user.keyboard('{Escape}')
            expect(document.activeElement).toBe(trigger)
            await user.click(trigger)
            expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
            expect(screen.queryByRole('button', { name: 'Xem trước' })).toBeNull()
            expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.preview).toHaveBeenCalledOnce()
            expect(mocks.samples).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled()
        })

    it('allows closing an in-flight confirmation, retains the guard and displays its eventual success', async () => {
        const pending = deferred(); mocks.confirm.mockReturnValue(pending.promise)
        const { user, trigger } = await open(); await prepare(user); await attest(user)
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await user.click(screen.getByRole('button', { name: 'Đóng' }))
        expect(document.activeElement).toBe(trigger)
        await user.click(trigger)
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        await act(async () => { pending.resolve(succeeded) })
        await screen.findByRole('heading', { name: 'Đã nhập thành công' })
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        expect(mocks.confirm).toHaveBeenCalledOnce()
    })

    it('does not put an unmounted attempt completion into another mounted flow', async () => {
        const pending = deferred(); mocks.confirm.mockReturnValue(pending.promise)
        const first = await open(); await prepare(first.user); await attest(first.user)
        await first.user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        first.unmount()
        await open()
        await act(async () => { pending.resolve(succeeded) })
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        expect(screen.getByRole('status').textContent).toMatch(/chưa rõ/i)
        expect(screen.queryByRole('heading', { name: 'Đã nhập thành công' })).toBeNull()
        expect(mocks.samples).not.toHaveBeenCalled()
        expect(first.invalidate).toHaveBeenCalledWith({ queryKey: sampleKeys.all })
        expect(first.invalidate).toHaveBeenCalledWith({ queryKey: searchKeys.all })
    })

    it('does not erase an in-flight outcome guard when its preview deadline passes', async () => {
        const pending = deferred(); mocks.confirm.mockReturnValue(pending.promise)
        const expiresAt = Date.now() + 1000
        mocks.preview.mockResolvedValue({ ...preview(), expiresAt: new Date(expiresAt).toISOString() })
        const { user } = await open(); await prepare(user); await attest(user)
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await waitFor(() => expect(Date.now()).toBeGreaterThan(expiresAt), { timeout: 2000 })
        await act(async () => { pending.resolve({ state: 'unknown', batchId }) })
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
        expect(screen.getByRole('status').textContent).toMatch(/chưa rõ/i)
        expect(mocks.confirm).toHaveBeenCalledOnce()
    })

    it('shows late official IDs for the same successful batch after close/reopen without a file', async () => {
        const pending = deferred(); mocks.samples.mockReturnValue(pending.promise)
        const { user, trigger } = await open(); await prepare(user); await attest(user)
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByRole('heading', { name: 'Đã nhập thành công' })
        await user.click(screen.getByRole('button', { name: 'Đóng' }))
        await user.click(trigger)
        await act(async () => { pending.resolve(sampleResponse) })
        expect(await screen.findByText('CDC-2026-000042')).toBeTruthy()
        expect(screen.queryByLabelText('Tệp Excel')).toBeNull()
    })

    it('ignores old official IDs after a known success is replaced by a new file flow', async () => {
        const pending = deferred(); mocks.samples.mockReturnValue(pending.promise)
        const { user } = await open(); await prepare(user); await attest(user)
        await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }))
        await screen.findByRole('heading', { name: 'Đã nhập thành công' })
        await user.click(screen.getByRole('button', { name: 'Nhập tệp khác' }))
        await prepare(user, 'lan-moi.xlsx')
        await act(async () => { pending.resolve(sampleResponse) })
        expect(screen.getByRole('checkbox', { name: attestation }).getAttribute('aria-checked')).toBe('false')
        expect(screen.queryByText('CDC-2026-000042')).toBeNull()
        expect(screen.queryByRole('heading', { name: 'Đã nhập thành công' })).toBeNull()
        expect(mocks.confirm).toHaveBeenCalledOnce()
    })
})
