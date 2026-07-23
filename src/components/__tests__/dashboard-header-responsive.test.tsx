import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
    default: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}))

vi.mock('@/components/global-search', () => ({
    GlobalSearch: ({
        className,
        skipShortcut,
        variant,
    }: {
        className?: string
        skipShortcut?: boolean
        variant?: string
    }) => (
        <div
            className={className}
            data-skip-shortcut={String(Boolean(skipShortcut))}
            data-testid={`global-search-${variant ?? 'auto'}`}
        />
    ),
}))

vi.mock('@/components/dashboard-nav', () => ({
    DashboardNav: ({
        className,
        variant,
    }: {
        className?: string
        variant: string
    }) => (
        <div
            className={className}
            data-testid={`dashboard-nav-${variant}`}
        />
    ),
}))

vi.mock('@/components/user-profile-dropdown', () => ({
    UserProfileDropdown: ({
        variant,
    }: {
        variant: string
    }) => <div data-testid={`user-profile-${variant}`} />,
}))

vi.mock('@/components/scanner/scanner-connection-button', () => ({
    ScannerConnectionButton: () => <div data-testid="scanner-connection-button" />,
}))

import { DashboardHeader } from '../dashboard-header'

const manager = {
    full_name: 'Manager A',
    role: 'manager' as const,
}

describe('DashboardHeader responsive composition', () => {
    it('mounts exactly three rows with the required visibility contracts', () => {
        render(<DashboardHeader subtitle="Quản lý mẫu" user={manager} />)

        const rows = screen.getAllByTestId(
            /dashboard-header-(mobile|compact|full)-row/,
        )
        const mobileRow = screen.getByTestId('dashboard-header-mobile-row')
        const compactRow = screen.getByTestId('dashboard-header-compact-row')
        const fullRow = screen.getByTestId('dashboard-header-full-row')

        expect(rows).toHaveLength(3)
        expect(mobileRow.id).toBe('dashboard-header-mobile-row')
        expect(compactRow.id).toBe('dashboard-header-compact-row')
        expect(fullRow.id).toBe('dashboard-header-full-row')

        expect(mobileRow.classList.contains('flex')).toBe(true)
        expect(mobileRow.classList.contains('md:hidden')).toBe(true)

        expect(compactRow.classList.contains('hidden')).toBe(true)
        expect(compactRow.classList.contains('md:flex')).toBe(true)
        expect(compactRow.classList.contains('min-[1800px]:hidden')).toBe(true)
        expect(compactRow.classList.contains('h-[64px]')).toBe(true)

        expect(fullRow.classList.contains('hidden')).toBe(true)
        expect(fullRow.classList.contains('min-[1800px]:flex')).toBe(true)

        rows.forEach((row) => {
            expect(row.className).not.toContain('max-[1799px]')
            expect(row.className).not.toContain('xl:hidden')
            expect(row.className).not.toContain('xl:block')
            expect(row.className).not.toContain('xl:flex')
        })
    })

    it('passes responsive variants and keeps only mobile search shortcut ownership', () => {
        render(<DashboardHeader subtitle="Quản lý mẫu" user={manager} />)

        expect(screen.getByTestId('dashboard-nav-mobile')).toBeDefined()
        expect(screen.getByTestId('dashboard-nav-compact')).toBeDefined()
        expect(screen.getByTestId('dashboard-nav-full')).toBeDefined()
        expect(screen.getByTestId('user-profile-responsive')).toBeDefined()
        expect(screen.getByTestId('user-profile-compact')).toBeDefined()
        expect(screen.getByTestId('user-profile-full')).toBeDefined()

        const searches = screen.getAllByTestId(/global-search-/)
        const mobileSearch = within(
            screen.getByTestId('dashboard-header-mobile-row'),
        ).getByTestId('global-search-compact')
        const compactSearch = within(
            screen.getByTestId('dashboard-header-compact-row'),
        ).getByTestId('global-search-compact')
        const fullSearch = within(
            screen.getByTestId('dashboard-header-full-row'),
        ).getByTestId('global-search-full')

        expect(searches).toHaveLength(3)
        expect(mobileSearch.dataset.skipShortcut).toBe('false')
        expect(compactSearch.dataset.skipShortcut).toBe('true')
        expect(fullSearch.dataset.skipShortcut).toBe('true')
        expect(
            searches.filter((search) => search.dataset.skipShortcut === 'false'),
        ).toHaveLength(1)
    })

    it('keeps mobile and compact content within stable nonshrinking groups', () => {
        render(<DashboardHeader subtitle="Quản lý mẫu" user={manager} />)

        const mobileRow = screen.getByTestId('dashboard-header-mobile-row')
        const mobileNav = within(mobileRow).getByTestId('dashboard-nav-mobile')
        const compactRow = screen.getByTestId('dashboard-header-compact-row')
        const compactNav = within(compactRow).getByTestId('dashboard-nav-compact')
        const compactSearch = within(compactRow).getByTestId('global-search-compact')
        const compactScanner = within(compactRow).getByTestId(
            'scanner-connection-button',
        )
        const compactProfile = within(compactRow).getByTestId(
            'user-profile-compact',
        )

        expect(mobileNav.parentElement?.className).toContain('min-w-0')
        expect(mobileNav.parentElement?.className).toContain('flex-1')

        expect(within(compactRow).getByText('CDC-LIMS Pro')).toBeDefined()
        expect(within(compactRow).queryByText('Quản lý mẫu')).toBeNull()
        expect(compactNav.parentElement?.className).toContain('shrink-0')
        expect(compactSearch.parentElement?.className).toContain('shrink-0')
        expect(compactSearch.parentElement?.contains(compactScanner)).toBe(true)
        expect(compactSearch.parentElement?.contains(compactProfile)).toBe(true)
    })

    it('keeps full search practical and full navigation nonwrapping', () => {
        render(<DashboardHeader subtitle="Quản lý mẫu" user={manager} />)

        const fullRow = screen.getByTestId('dashboard-header-full-row')
        const fullSearchSlot = screen.getByTestId('dashboard-header-full-search')
        const fullNav = within(fullRow).getByTestId('dashboard-nav-full')

        expect(fullSearchSlot.id).toBe('dashboard-header-full-search')
        expect(fullSearchSlot.className).toContain('min-w-[18rem]')
        expect(fullNav.className).toContain('shrink-0')
        expect(fullNav.className).toContain('whitespace-nowrap')
    })
})
