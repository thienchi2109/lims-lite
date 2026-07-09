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

vi.mock('@/components/logout-button', () => ({
    LogoutButton: () => <button type="button">Đăng xuất</button>,
}))

vi.mock('@/components/manager-otp-verification-form', () => ({
    ManagerOtpVerificationForm: ({ initialMaskedEmail }: { initialMaskedEmail: string | null }) => (
        <div data-testid="manager-otp-form">{initialMaskedEmail}</div>
    ),
}))

import ManagerOtpPage from './page'

describe('ManagerOtpPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getUser.mockResolvedValue({ data: { user: { id: 'manager-1' } } })
        mocks.single
            .mockResolvedValueOnce({ data: { full_name: 'Quản lý', role: 'manager' } })
            .mockResolvedValueOnce({ data: null })
    })

    it('shows Vietnamese admin recovery guidance without the dashboard shell when OTP email is not configured', async () => {
        render(await ManagerOtpPage())

        expect(screen.queryByTestId('dashboard-header')).toBeNull()
        expect(screen.getByText('CDC-LIMS Pro')).toBeDefined()
        expect(screen.getByRole('heading', { name: 'Cần cấu hình email nhận mã' })).toBeDefined()
        expect(screen.getByText(/liên hệ quản trị viên/i)).toBeDefined()
        expect(screen.getByText(/Quản lý người dùng/i)).toBeDefined()
        expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeDefined()
        expect(screen.queryByRole('link', { name: 'Đăng xuất' })).toBeNull()
    })

    it('renders the verification form with only a masked OTP email when configuration exists', async () => {
        mocks.single
            .mockReset()
            .mockResolvedValueOnce({ data: { full_name: 'Quản lý', role: 'manager' } })
            .mockResolvedValueOnce({ data: { otp_email: 'manager@example.com' } })

        render(await ManagerOtpPage())

        expect(screen.getByTestId('manager-otp-form').textContent).toBe('ma***@example.com')
        expect(screen.queryByText('manager@example.com')).toBeNull()
    })

    it('keeps /manager/otp compatible for confidential analysts using the shared OTP flow', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: { id: 'analyst-hiv-1' } } })
        mocks.single
            .mockReset()
            .mockResolvedValueOnce({
                data: {
                    full_name: 'Kỹ thuật viên HIV',
                    role: 'analyst',
                    can_access_confidential: true,
                },
            })
            .mockResolvedValueOnce({ data: { otp_email: 'analyst@example.com' } })

        render(await ManagerOtpPage())

        expect(screen.getByTestId('manager-otp-form').textContent).toBe('an***@example.com')
        expect(screen.queryByText('analyst@example.com')).toBeNull()
    })
})
