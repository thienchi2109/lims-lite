import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useOptionalScannerMock = vi.fn()

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

vi.mock('./use-scanner', () => ({
    useOptionalScanner: () => useOptionalScannerMock(),
}))

import { ScannerConnectionButton } from './scanner-connection-button'

describe('ScannerConnectionButton', () => {
    beforeEach(() => {
        useOptionalScannerMock.mockReset()
    })

    it('does not render outside the authenticated scanner provider', () => {
        useOptionalScannerMock.mockReturnValue(null)
        const { container } = render(<ScannerConnectionButton />)
        expect(container.firstChild).toBeNull()
    })

    it.each([
        ['permission_required', 'Kết nối scanner', false],
        ['connecting', 'Đang kết nối scanner', true],
        ['unsupported', 'Trình duyệt không hỗ trợ Web Serial', true],
    ] as const)('renders the %s state', (state, accessibleName, disabled) => {
        useOptionalScannerMock.mockReturnValue({
            state,
            error: null,
            connect: vi.fn(),
            disconnect: vi.fn(),
        })

        render(<ScannerConnectionButton />)

        expect(screen.getByRole('button', { name: accessibleName })).toHaveProperty(
            'disabled',
            disabled,
        )
    })

    it('connects or reconnects from an explicit user action', () => {
        const connect = vi.fn()
        useOptionalScannerMock.mockReturnValue({
            state: 'error',
            error: 'Port busy',
            connect,
            disconnect: vi.fn(),
        })

        render(<ScannerConnectionButton />)
        fireEvent.click(screen.getByRole('button', { name: 'Kết nối lại scanner' }))

        expect(connect).toHaveBeenCalledTimes(1)
    })

    it('disconnects an active scanner connection', () => {
        const disconnect = vi.fn()
        useOptionalScannerMock.mockReturnValue({
            state: 'connected',
            error: null,
            connect: vi.fn(),
            disconnect,
        })

        render(<ScannerConnectionButton />)
        fireEvent.click(screen.getByRole('button', { name: 'Ngắt kết nối scanner' }))

        expect(disconnect).toHaveBeenCalledTimes(1)
    })

    it('keeps the unsupported-state tooltip available on a disabled button', async () => {
        useOptionalScannerMock.mockReturnValue({
            state: 'unsupported',
            error: null,
            connect: vi.fn(),
            disconnect: vi.fn(),
        })

        const user = userEvent.setup()
        render(<ScannerConnectionButton />)

        const button = screen.getByRole('button', {
            name: 'Trình duyệt không hỗ trợ Web Serial',
        })
        expect(button.parentElement?.dataset.slot).toBe('tooltip-trigger')

        await user.hover(button.parentElement as HTMLElement)

        expect(
            await screen.findByRole('tooltip', {
                name: 'Trình duyệt không hỗ trợ Web Serial',
            }),
        ).toBeDefined()
    })
})
