import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
    default: (props: { alt: string }) => <span aria-label={props.alt} />,
}))

vi.mock('@/components/global-search', () => ({
    GlobalSearch: () => <div data-testid="global-search" />,
}))

vi.mock('@/components/dashboard-nav', () => ({
    DashboardNav: () => <div data-testid="dashboard-nav" />,
}))

vi.mock('@/components/user-profile-dropdown', () => ({
    UserProfileDropdown: ({ user }: { user: { role: string | null } }) => (
        <div data-testid="user-profile-dropdown">{user.role}</div>
    ),
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

        expect(screen.queryByTestId('global-search')).toBeNull()
        expect(screen.getAllByTestId('user-profile-dropdown')).toHaveLength(2)
        expect(screen.getAllByTestId('user-profile-dropdown')[0].textContent).toBe('doctor')
    })
})
