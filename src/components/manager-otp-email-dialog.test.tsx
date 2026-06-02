import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    configureManagerOtpEmailClient: vi.fn(),
    getMaskedManagerOtpEmailClient: vi.fn(),
    refresh: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
    configureManagerOtpEmailClient: (...args: unknown[]) => mocks.configureManagerOtpEmailClient(...args),
    getMaskedManagerOtpEmailClient: (...args: unknown[]) => mocks.getMaskedManagerOtpEmailClient(...args),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => mocks.toastSuccess(...args),
        error: (...args: unknown[]) => mocks.toastError(...args),
    },
}))

import { ManagerOtpEmailDialog } from './manager-otp-email-dialog'

describe('ManagerOtpEmailDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getMaskedManagerOtpEmailClient.mockResolvedValue({ otpEmail: 'ma***@example.com' })
        mocks.configureManagerOtpEmailClient.mockResolvedValue({ success: true })
    })

    it('loads the masked destination and saves a new OTP email through api-client', async () => {
        render(
            <ManagerOtpEmailDialog
                open
                onOpenChange={vi.fn()}
                user={{ id: 'manager-2', full_name: 'Quản lý 2', role: 'manager' }}
            />,
        )

        expect(await screen.findByText(/ma\*\*\*@example\.com/)).toBeDefined()
        fireEvent.change(screen.getByLabelText('Email nhận OTP'), { target: { value: 'otp@example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Lưu email OTP' }))

        await waitFor(() => {
            expect(mocks.configureManagerOtpEmailClient).toHaveBeenCalledWith({
                userId: 'manager-2',
                otpEmail: 'otp@example.com',
            })
        })
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã cập nhật email nhận OTP')
        expect(mocks.refresh).toHaveBeenCalled()
    })

    it('keeps the save action disabled until a valid email is entered', async () => {
        render(
            <ManagerOtpEmailDialog
                open
                onOpenChange={vi.fn()}
                user={{ id: 'manager-2', full_name: 'Quản lý 2', role: 'manager' }}
            />,
        )

        await screen.findByText(/ma\*\*\*@example\.com/)
        fireEvent.change(screen.getByLabelText('Email nhận OTP'), { target: { value: 'not-an-email' } })

        expect(screen.getByRole('button', { name: 'Lưu email OTP' })).toHaveProperty('disabled', true)
    })
})
