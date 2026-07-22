import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
    default: (props: { alt: string }) => <span aria-label={props.alt} />,
}))

vi.mock('@/components/global-search', () => ({
    GlobalSearch: ({ variant, className }: { variant?: string; className?: string }) => (
        <div data-testid={`global-search-${variant ?? 'auto'}`} className={className} />
    ),
}))

vi.mock('@/components/dashboard-nav', () => ({
    DashboardNav: () => <div data-testid="dashboard-nav" />,
}))

vi.mock('@/components/user-profile-dropdown', () => ({
    UserProfileDropdown: ({ user }: { user: { role: string | null } }) => (
        <div data-testid="user-profile-dropdown">{user.role}</div>
    ),
}))

vi.mock('@/components/scanner/scanner-connection-button', () => ({
    ScannerConnectionButton: () => <button data-testid="scanner-connection-button" />,
}))

import { DashboardHeader } from '../dashboard-header'

describe('DashboardHeader doctor restrictions', () => {
    it('does not render global search for doctors', () => {
        render(
            <DashboardHeader
                subtitle="Quản lý mẫu"
                user={{
                    full_name: 'Doctor A',
                    role: 'doctor',
                }}
            />,
        )

        expect(screen.queryByTestId('global-search-full')).toBeNull()
        expect(screen.queryByTestId('global-search-compact')).toBeNull()
        expect(screen.getAllByTestId('scanner-connection-button')).toHaveLength(2)
        expect(screen.getAllByTestId('user-profile-dropdown')).toHaveLength(2)
        expect(screen.getAllByTestId('user-profile-dropdown')[0].textContent).toBe('doctor')
    })

    it('keeps desktop global search inside the main header row', () => {
        render(
            <DashboardHeader
                subtitle="Quản lý mẫu"
                user={{
                    full_name: 'Analyst A',
                    role: 'analyst',
                }}
            />,
        )

        const desktopRow = screen.getByTestId('dashboard-header-desktop-row')
        const desktopSearchSlot = screen.getByTestId('dashboard-header-desktop-search')
        const desktopSearch = screen.getByTestId('global-search-full')

        expect(screen.queryByTestId('dashboard-header-search-row')).toBeNull()
        expect(desktopRow.contains(desktopSearch)).toBe(true)
        expect(desktopSearchSlot.contains(desktopSearch)).toBe(true)
        expect(desktopSearchSlot.className).toContain('min-w-0')
        expect(desktopSearchSlot.className).toContain('max-w-md')
        expect(screen.getAllByTestId('scanner-connection-button')).toHaveLength(2)
    })
})
