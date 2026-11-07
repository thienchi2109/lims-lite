// Phase 1 browser interactions only; mocked previews do not prove runtime acceptance.
import { act, cleanup, render as renderUI, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ preview: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ createAccessionPreviewClient: mocks.preview }))
vi.mock('@/components/walkthrough', () => ({
    WalkthroughTrigger: ({ className }: { className?: string }) => <button className={className}>Hướng dẫn</button>,
}))

import { AccessionPageHeader } from './accession-page-header'

function render(ui: React.ReactNode) {
    return renderUI(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

const batchId = '11111111-1111-4111-8111-111111111111'
const client = {
    name: 'Khách thử nghiệm', dateOfBirth: '1990-01-02', governmentIdentityType: null,
    governmentIdentityValue: null, gender: 'Nam', phone: '0912345678', address: null,
    healthInsuranceNum: null, expiryDate: null,
}
const preview = {
    ok: true, batchId, previewCreatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1800000).toISOString(),
    counts: { clients: 2, samples: 3, assignments: 4, create: 1, reuse: 1 },
    clients: [
        { row: 2, disposition: 'create', input: client, existingValues: null, unchangedFields: [] },
        { row: 3, disposition: 'reuse', input: { ...client, name: 'Tên trong Excel' },
            existingValues: { ...client, name: 'Tên đang lưu', address: 'Địa chỉ đang lưu' },
            unchangedFields: ['name', 'address'] },
    ],
}
const rowError = {
    sheet: 'Mẫu', row: 2, column: 'C', header: 'Mã loại mẫu', temporaryReference: 'M-01',
    code: 'CATALOG_STALE', message: 'Danh mục đã thay đổi. Hãy tải template mới và xem trước lại.',
}

function deferred() {
    let resolve!: (value: unknown) => void
    const promise = new Promise(done => { resolve = done })
    return { promise, resolve }
}

async function openPreview() {
    const user = userEvent.setup()
    const rendered = render(<AccessionPageHeader />)
    const trigger = screen.getByRole('button', { name: 'Nhập từ Excel' })
    await user.click(trigger)
    return { user, trigger, ...rendered }
}

async function selectFile(user: ReturnType<typeof userEvent.setup>, size = 10, name = 'mau.xlsx') {
    const file = new File([new Uint8Array(size)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await user.upload(screen.getByLabelText('Tệp Excel'), file)
    return file
}

beforeEach(() => {
    mocks.preview.mockReset(); mocks.preview.mockResolvedValue(preview)
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('accession Excel preview', () => {
    it('opens by keyboard beside template, keeps wrapping/walkthrough and returns focus on Escape', async () => {
        const user = userEvent.setup()
        render(<AccessionPageHeader />)
        const template = screen.getByRole('button', { name: 'Tải template Excel' })
        const trigger = screen.getByRole('button', { name: 'Nhập từ Excel' })
        expect(template.parentElement).toBe(trigger.parentElement)
        expect(trigger.closest('.flex-wrap')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Hướng dẫn' }).className).toContain('hidden xl:inline-flex')
        await user.tab()
        await user.tab()
        expect(document.activeElement).toBe(trigger)
        await user.keyboard('{Enter}')
        expect(screen.getByRole('dialog', { name: 'Nhập từ Excel' })).toBeTruthy()
        expect(screen.getByLabelText('Tệp Excel')).toBeTruthy()
        expect(screen.getByText(/10\.000\.000 byte/)).toBeTruthy()
        await user.keyboard('{Escape}')
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(document.activeElement).toBe(trigger)
    })

    it.each([0, 10000000, 10000001])('rejects %s-byte files without uploading', async size => {
        const { user } = await openPreview()
        await selectFile(user, size)
        expect(screen.getByRole('alert').textContent).toMatch(/tệp.*không rỗng.*nhỏ hơn 10\.000\.000 byte/i)
        expect(screen.getByRole('button', { name: 'Xem trước' }).hasAttribute('disabled')).toBe(true)
        expect(mocks.preview).not.toHaveBeenCalled()
    })

    it('admits 9,999,999 bytes and shows complete immutable counts and client decisions', async () => {
        const { user } = await openPreview()
        const file = await selectFile(user, 9999999)
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        await screen.findByRole('heading', { name: 'Kết quả xem trước' })
        expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(file, undefined, { signal: expect.any(AbortSignal) })
        const summary = screen.getByRole('region', { name: 'Tổng quan nhập Excel' })
        for (const text of ['2 khách hàng', '3 mẫu', '4 chỉ định', '1 tạo mới', '1 dùng lại']) {
            expect(within(summary).getByText(text)).toBeTruthy()
        }
        expect(screen.getByText('Tên trong Excel')).toBeTruthy()
        expect(screen.getByText('Tên đang lưu')).toBeTruthy()
        expect(screen.getByText('Địa chỉ đang lưu')).toBeTruthy()
        expect(screen.getByText(/Giữ nguyên.*Họ và tên.*Địa chỉ/)).toBeTruthy()
        expect(screen.getByText(/Hết hạn xem trước/)).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Xác nhận nhập' }).hasAttribute('disabled')).toBe(true)
        expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('prevents duplicate previews, cancels waiting and ignores a late response', async () => {
        const pending = deferred()
        mocks.preview.mockReturnValue(pending.promise)
        const { user } = await openPreview()
        await selectFile(user)
        await user.dblClick(screen.getByRole('button', { name: 'Xem trước' }))
        expect(mocks.preview).toHaveBeenCalledOnce()
        const busy = screen.getByRole('button', { name: 'Đang xem trước…' })
        expect(busy.getAttribute('aria-busy')).toBe('true')
        expect(busy.hasAttribute('disabled')).toBe(true)
        const signal = mocks.preview.mock.calls[0][2].signal as AbortSignal
        await user.click(screen.getByRole('button', { name: 'Hủy xem trước' }))
        expect(signal.aborted).toBe(true)
        expect(screen.getByRole('status').textContent).toMatch(/Đã dừng chờ/)
        expect(screen.getByRole('status').textContent).not.toMatch(/hoàn tác|rollback/i)
        await act(async () => { pending.resolve(preview) })
        expect(screen.queryByRole('heading', { name: 'Kết quả xem trước' })).toBeNull()
    })

    it('aborts and clears on replacement, ignores stale data and previews only the new file', async () => {
        const pending = deferred()
        mocks.preview.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(preview)
        const { user } = await openPreview()
        await selectFile(user)
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        const signal = mocks.preview.mock.calls[0][2].signal as AbortSignal
        const replacement = await selectFile(user, 12, 'mau-moi.xlsx')
        expect(signal.aborted).toBe(true)
        await act(async () => { pending.resolve(preview) })
        expect(screen.queryByText('Tên đang lưu')).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        await screen.findByRole('heading', { name: 'Kết quả xem trước' })
        expect(mocks.preview.mock.calls[1][0]).toBe(replacement)
        await selectFile(user, 13, 'khac.xlsx')
        expect(screen.queryByText('Tên đang lưu')).toBeNull()
    })

    it('aborts on close, clears file and private display on reopen and ignores the old response', async () => {
        const pending = deferred()
        mocks.preview.mockReturnValue(pending.promise)
        const { user, trigger } = await openPreview()
        await selectFile(user)
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        const signal = mocks.preview.mock.calls[0][2].signal as AbortSignal
        await user.click(screen.getByRole('button', { name: 'Đóng' }))
        expect(signal.aborted).toBe(true)
        await user.click(trigger)
        await act(async () => { pending.resolve(preview) })
        expect((screen.getByLabelText('Tệp Excel') as HTMLInputElement).files?.length).toBe(0)
        expect(screen.queryByText('Tên đang lưu')).toBeNull()
        expect(screen.getByRole('button', { name: 'Xem trước' }).hasAttribute('disabled')).toBe(true)
    })

    it('aborts pending work on unmount without presenting late data', async () => {
        const pending = deferred()
        mocks.preview.mockReturnValue(pending.promise)
        const { user, unmount } = await openPreview()
        await selectFile(user)
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        const signal = mocks.preview.mock.calls[0][2].signal as AbortSignal
        unmount()
        expect(signal.aborted).toBe(true)
        await act(async () => { pending.resolve(preview) })
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('renders every row failure with sheet/row/column/reason/remedy and related locations', async () => {
        const errors = Array.from({ length: 120 }, (_, index) => ({ ...rowError, row: index + 2 }))
        errors[119] = { ...rowError, row: 121, message: 'Lỗi cuối danh sách. Hãy tải template mới.' }
        mocks.preview.mockResolvedValue({ ok: false, batchId, errors: [
            ...errors, { ...rowError, sheet: 'Khách hàng', row: 9, relatedLocations: [{
                sheet: 'Mẫu', row: 15, column: 'C', header: 'Mã loại mẫu', temporaryReference: 'M-02',
            }] },
        ] })
        const { user } = await openPreview()
        await selectFile(user)
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        const table = await screen.findByRole('table', { name: 'Lỗi cần sửa trong Excel' })
        expect(within(table).getAllByRole('row')).toHaveLength(122)
        expect(within(table).getByText('Lỗi cuối danh sách. Hãy tải template mới.')).toBeTruthy()
        expect(within(table).getAllByText('Mẫu').length).toBeGreaterThan(1)
        expect(within(table).getByText('121')).toBeTruthy()
        expect(within(table).getAllByText('C — Mã loại mẫu').length).toBeGreaterThan(1)
        expect(within(table).getByText(/Liên quan.*Mẫu.*15/)).toBeTruthy()
        expect(within(table).getAllByText(/Tải template mới/).length).toBeGreaterThan(1)
        expect(screen.queryByRole('heading', { name: 'Kết quả xem trước' })).toBeNull()
        expect(screen.queryByRole('button', { name: /Xác nhận nhập/ })).toBeNull()
    })

    it.each([
        null, { ok: true }, { ...preview, clients: undefined }, { ...preview, counts: { ...preview.counts, samples: '3' } },
        { ...preview, clients: [{ ...preview.clients[0], disposition: 'merged' }] },
        { ...preview, normalizedPayload: ['RAW_PRIVATE'] }, { ok: false, batchId, errors: [] },
    ])('fails closed for malformed preview response %#', async body => {
        mocks.preview.mockResolvedValue(body)
        const { user } = await openPreview()
        await selectFile(user)
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        expect((await screen.findByRole('alert')).textContent).toMatch(/Chưa thể xem trước.*thử lại/)
        expect(screen.queryByText('Tên đang lưu')).toBeNull()
        expect(screen.queryByRole('heading', { name: 'Kết quả xem trước' })).toBeNull()
        expect(screen.queryByText('RAW_PRIVATE')).toBeNull()
    })

    it.each(['RAW_DATABASE_SECRET', 'Bạn không có quyền truy cập.', 'Phiên đăng nhập đã hết hạn.'])('shows safe Vietnamese failure and permits retry for %s', async reason => {
        mocks.preview.mockRejectedValueOnce(new Error(reason)).mockResolvedValueOnce(preview)
        const { user } = await openPreview()
        await selectFile(user)
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        expect((await screen.findByRole('alert')).textContent).toMatch(/Chưa thể xem trước.*đăng nhập.*quyền.*thử lại/)
        expect(screen.queryByText('RAW_DATABASE_SECRET')).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Xem trước' }))
        await screen.findByRole('heading', { name: 'Kết quả xem trước' })
    })
})
