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

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    ),
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <>{children}</> : null),
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/avatar', () => ({
    Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AvatarFallback: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AvatarImage: () => null,
}))

vi.mock('lucide-react', () => ({
    User: () => null,
    LogOut: () => null,
    Settings: () => null,
    ChevronDown: () => null,
}))

vi.mock('next/link', () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import { UserProfileDropdown } from '../user-profile-dropdown'

describe('UserProfileDropdown cache isolation', () => {
    beforeEach(() => {
        mockReplace.mockClear()
        mockLogoutClient.mockReset()
        mockQueryClient.clear.mockClear()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('clears the query cache before redirecting when the dashboard logout flow fails', async () => {
        mockLogoutClient.mockRejectedValueOnce(new Error('logout failed'))

        render(
            <UserProfileDropdown
                user={{
                    full_name: 'Manager HIV',
                    role: 'manager',
                }}
            />,
        )

        fireEvent.click(await screen.findByRole('button', { name: /Manager HIV/i }))
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
