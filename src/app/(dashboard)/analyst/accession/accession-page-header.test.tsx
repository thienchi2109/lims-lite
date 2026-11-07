import { cleanup, render as renderUI, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: mocks.error } }))

vi.mock('@/components/walkthrough', () => ({
    WalkthroughTrigger: ({
        className,
    }: {
        className?: string
    }) => (
        <button
            type="button"
            data-testid="walkthrough-trigger"
            className={className}
        >
            Hướng dẫn
        </button>
    ),
}))

import { AccessionPageHeader } from './accession-page-header'

function render(ui: React.ReactNode) {
    return renderUI(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

describe('AccessionPageHeader', () => {
    const fetchMock = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:synthetic-template')
    const revokeObjectURL = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('fetch', fetchMock)
        vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    })
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('hides the walkthrough trigger while the mobile accession UI is active', () => {
        render(<AccessionPageHeader />)

        const trigger = screen.getByTestId('walkthrough-trigger')

        expect(trigger.className).toContain('hidden')
        expect(trigger.className).toContain('xl:inline-flex')
    })

    it('downloads from the actual header with keyboard focus, pending state and memory cleanup', async () => {
        let resolve!: (value: Response) => void
        fetchMock.mockReturnValue(new Promise<Response>(done => { resolve = done }))
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.download).toBe('lims-tiep-nhan-mau-v1.xlsx')
            expect(this.href).toBe('blob:synthetic-template')
            expect(this.isConnected).toBe(true)
        })
        const user = userEvent.setup()
        render(<AccessionPageHeader />)
        const button = screen.getByRole('button', { name: 'Tải template Excel' })
        await user.tab()
        expect(document.activeElement).toBe(button)
        await user.keyboard('{Enter}')
        expect(button.hasAttribute('disabled')).toBe(true)
        expect(button.getAttribute('aria-busy')).toBe('true')
        expect(screen.getByText('Đang tải template…')).toBeTruthy()
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/accession/template', {
            cache: 'no-store', credentials: 'same-origin',
        })
        resolve(new Response(new Uint8Array([0x50, 0x4b]), { headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="lims-tiep-nhan-mau-v1.xlsx"',
        } }))
        await waitFor(() => expect(click).toHaveBeenCalledOnce())
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:synthetic-template')
        expect(document.querySelector('a[download]')).toBeNull()
        expect(button.hasAttribute('disabled')).toBe(false)
        expect(document.activeElement).toBe(button)
        expect(screen.getByTestId('walkthrough-trigger')).toBeTruthy()
        expect(button.closest('.flex-wrap')).toBeTruthy()
    })

    it.each([401, 403, 503, 500])('shows a safe Vietnamese error and supports retry after HTTP %s', async status => {
        fetchMock.mockImplementation(async () => new Response('RAW_SECRET_PAYLOAD', { status }))
        const user = userEvent.setup()
        render(<AccessionPageHeader />)
        const button = screen.getByRole('button', { name: 'Tải template Excel' })
        await user.click(button)
        await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce())
        expect(mocks.error.mock.calls[0][0]).toMatch(/đăng nhập|quyền tải|Chưa thể tải/)
        expect(mocks.error.mock.calls[0][0]).not.toContain('RAW_SECRET')
        expect(button.hasAttribute('disabled')).toBe(false)
        await user.click(button)
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(createObjectURL).not.toHaveBeenCalled()
    })

    it.each(['network', 'html', 'filename', 'anchor'])('fails safely and releases memory on %s failure', async failure => {
        if (failure === 'network') fetchMock.mockRejectedValue(new Error('RAW_NETWORK'))
        else fetchMock.mockResolvedValue(new Response('synthetic', { headers: {
            'Content-Type': failure === 'html' ? 'text/html' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': failure === 'filename' ? 'attachment; filename="../../secret.xlsx"' : 'attachment; filename="lims-tiep-nhan-mau-v1.xlsx"',
        } }))
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('RAW_ANCHOR') })
        const user = userEvent.setup()
        render(<AccessionPageHeader />)
        await user.click(screen.getByRole('button', { name: 'Tải template Excel' }))
        await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Chưa thể tải template Excel. Vui lòng thử lại sau.'))
        expect(document.querySelector('a[download]')).toBeNull()
        if (failure === 'anchor') expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:synthetic-template')
        else expect(createObjectURL).not.toHaveBeenCalled()
    })
})
