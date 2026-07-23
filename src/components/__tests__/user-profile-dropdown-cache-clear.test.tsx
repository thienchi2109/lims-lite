import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    ChevronDown: (props: ComponentProps<'svg'>) => <svg data-testid="chevron-down" {...props} />,
}))

vi.mock('next/link', () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import { UserProfileDropdown } from '../user-profile-dropdown'

const user = {
    full_name: 'Manager HIV',
    role: 'manager',
}

describe('UserProfileDropdown trigger variants', () => {
    it('renders the compact trigger as an avatar-only fixed-size button', () => {
        render(<UserProfileDropdown user={user} variant="compact" />)

        const trigger = screen.getByRole('button', { name: 'Mở menu tài khoản' })
        const triggerContent = within(trigger)

        expect(trigger.className).toContain('h-10 w-10 shrink-0 p-0')
        expect(triggerContent.getByText('MH')).toBeDefined()
        expect(triggerContent.queryByText('Manager HIV')).toBeNull()
        expect(triggerContent.queryByText('Quản lý')).toBeNull()
        expect(triggerContent.queryByTestId('chevron-down')).toBeNull()
    })

    it('renders the full trigger with constrained name, role, and chevron', () => {
        render(<UserProfileDropdown user={user} variant="full" />)

        const trigger = screen.getByRole('button', { name: 'Mở menu tài khoản' })
        const triggerContent = within(trigger)
        const visibleName = triggerContent.getByText('Manager HIV')
        const chevron = triggerContent.getByTestId('chevron-down')

        expect(visibleName.className).toContain('max-w-')
        expect(visibleName.className).toContain('truncate')
        expect(visibleName.parentElement?.className).not.toContain('hidden')
        expect(triggerContent.getByText('Quản lý')).toBeDefined()
        expect(chevron.getAttribute('class')).not.toContain('hidden')
    })

    it('uses the responsive trigger contract by default and when requested', () => {
        const { rerender } = render(<UserProfileDropdown user={user} />)

        const assertResponsiveTrigger = () => {
            const trigger = screen.getByRole('button', { name: 'Mở menu tài khoản' })
            const triggerContent = within(trigger)

            expect(triggerContent.getByText('Manager HIV').parentElement?.className).toContain('hidden sm:flex')
            expect(triggerContent.getByTestId('chevron-down').getAttribute('class')).toContain('hidden sm:block')
        }

        assertResponsiveTrigger()

        rerender(<UserProfileDropdown user={user} variant="responsive" />)

        assertResponsiveTrigger()
    })
})

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

        fireEvent.click(await screen.findByRole('button', { name: 'Mở menu tài khoản' }))
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
