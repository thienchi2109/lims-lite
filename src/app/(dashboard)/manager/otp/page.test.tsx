import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    single: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: mocks.getUser,
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: mocks.single,
                }),
            }),
        }),
    }),
}))

vi.mock('next/navigation', () => ({
    redirect: (url: string) => {
        throw new Error(`redirect:${url}`)
    },
}))

vi.mock('@/components/dashboard-header', () => ({
    DashboardHeader: ({ subtitle, user }: { subtitle: string; user?: { full_name?: string | null } | null }) => (
        <header data-testid="dashboard-header">{`${subtitle}-${user?.full_name ?? ''}`}</header>
    ),
}))

import ManagerOtpPage from './page'

describe('ManagerOtpPage', () => {
    beforeEach(() => {
        mocks.getUser.mockResolvedValue({ data: { user: { id: 'manager-1' } } })
        mocks.single.mockResolvedValue({ data: { full_name: 'Quản lý', role: 'manager' } })
    })

    it('shows Vietnamese admin recovery guidance inside the dashboard shell when OTP email is not configured', async () => {
        render(await ManagerOtpPage())

        expect(screen.getByTestId('dashboard-header').textContent).toContain('Xác thực email quản lý')
        expect(screen.getByTestId('dashboard-header').textContent).toContain('Quản lý')
        expect(screen.getByRole('heading', { name: 'Xác thực email quản lý' })).toBeDefined()
        expect(screen.getByText(/liên hệ quản trị viên/i)).toBeDefined()
        expect(screen.getByText(/Quản lý người dùng/i)).toBeDefined()
        expect(screen.getByRole('link', { name: 'Đăng xuất' }).getAttribute('href')).toBe('/logout')
    })
})
