import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'

const mockReplace = vi.fn()
const mockLogoutClient = vi.fn()
const mockQueryClient = {
    clear: vi.fn(),
}

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
}))

vi.mock('@/lib/api-client', () => ({
    logoutClient: (...args: unknown[]) => mockLogoutClient(...args),
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')

    return {
        ...actual,
        useQueryClient: () => mockQueryClient,
    }
})

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: ComponentProps<'button'>) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <>{children}</> : null),
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogClose: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import { LogoutButton } from '../logout-button'

describe('LogoutButton cache isolation', () => {
    beforeEach(() => {
        mockReplace.mockClear()
        mockLogoutClient.mockReset()
        mockQueryClient.clear.mockClear()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('clears the query cache before redirecting even if logout fails', async () => {
        mockLogoutClient.mockRejectedValueOnce(new Error('logout failed'))

        render(<LogoutButton />)

        fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
        fireEvent.click(screen.getAllByRole('button', { name: 'Đăng xuất' })[1])

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('/login')
        })

        expect(mockQueryClient.clear).toHaveBeenCalled()
        expect(mockQueryClient.clear.mock.invocationCallOrder[0]).toBeLessThan(
            mockReplace.mock.invocationCallOrder[0],
        )
    })
})
