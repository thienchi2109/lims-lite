import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
    default: (props: { alt: string }) => <span aria-label={props.alt} />,
}))

vi.mock('@/components/global-search', () => ({
    GlobalSearch: ({
        variant,
        className,
        skipShortcut,
    }: {
        variant?: string
        className?: string
        skipShortcut?: boolean
    }) => (
        <div
            data-testid={`global-search-${variant ?? 'auto'}`}
            data-skip-shortcut={String(Boolean(skipShortcut))}
            className={className}
        />
    ),
}))

vi.mock('@/components/dashboard-nav', () => ({
    DashboardNav: ({ variant }: { variant: string }) => (
        <div data-testid={`dashboard-nav-${variant}`} />
    ),
}))

vi.mock('@/components/user-profile-dropdown', () => ({
    UserProfileDropdown: ({
        user,
        variant,
    }: {
        user: { role: string | null }
        variant: string
    }) => (
        <div data-testid={`user-profile-${variant}`}>{user.role}</div>
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

        expect(screen.queryAllByTestId(/global-search-/)).toHaveLength(0)
        expect(screen.getAllByTestId(/dashboard-nav-/)).toHaveLength(3)
        expect(screen.getAllByTestId('scanner-connection-button')).toHaveLength(3)
        expect(screen.getAllByTestId(/user-profile-/)).toHaveLength(3)
        expect(screen.getByTestId('user-profile-responsive').textContent).toBe('doctor')
        expect(screen.getByTestId('user-profile-compact').textContent).toBe('doctor')
        expect(screen.getByTestId('user-profile-full').textContent).toBe('doctor')
    })

    it('keeps full global search inside the full header row', () => {
        render(
            <DashboardHeader
                subtitle="Quản lý mẫu"
                user={{
                    full_name: 'Analyst A',
                    role: 'analyst',
                }}
            />,
        )

        const fullRow = screen.getByTestId('dashboard-header-full-row')
        const fullSearchSlot = screen.getByTestId('dashboard-header-full-search')
        const fullSearch = screen.getByTestId('global-search-full')

        expect(screen.queryByTestId('dashboard-header-search-row')).toBeNull()
        expect(fullRow.contains(fullSearch)).toBe(true)
        expect(fullSearchSlot.contains(fullSearch)).toBe(true)
        expect(fullSearchSlot.id).toBe('dashboard-header-full-search')
        expect(fullSearchSlot.className).toContain('min-w-[18rem]')
        expect(fullSearchSlot.className).toContain('max-w-md')
        expect(screen.getAllByTestId('scanner-connection-button')).toHaveLength(3)
    })
})
