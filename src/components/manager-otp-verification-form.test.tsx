import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({
    replace: vi.fn(),
    refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => router,
}))

import { ManagerOtpVerificationForm } from './manager-otp-verification-form'

describe('ManagerOtpVerificationForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/api/manager/otp/challenge')) {
                return Response.json({
                    ok: true,
                    challengeId: '33333333-3333-4333-8333-333333333333',
                    maskedEmail: 'ma***@example.com',
                    expiresAt: '2026-06-02T04:05:00.000Z',
                    resendAvailableAt: '2026-06-02T04:01:00.000Z',
                })
            }

            if (url.endsWith('/api/manager/otp/verify')) {
                return Response.json({ ok: true })
            }

            return Response.json({ ok: false, status: 'provider_failed' }, { status: 503 })
        }) as typeof fetch
    })

    it('sends an OTP, shows the masked destination, and verifies a six-digit code', async () => {
        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/mã OTP đã được gửi/i)).toBeDefined()
        expect(screen.getByText(/ma\*\*\*@example\.com/)).toBeDefined()

        fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '123456' } })
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/manager/otp/verify', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    challengeId: '33333333-3333-4333-8333-333333333333',
                    code: '123456',
                }),
            }))
        })
        expect(router.replace).toHaveBeenCalledWith('/manager')
        expect(router.refresh).toHaveBeenCalled()
    })

    it('shows Vietnamese provider-failure guidance without exposing a full email address', async () => {
        global.fetch = vi.fn(async () => Response.json(
            { ok: false, status: 'provider_failed', maskedEmail: 'ma***@example.com' },
            { status: 503 },
        )) as typeof fetch

        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/không thể gửi mã OTP/i)).toBeDefined()
        expect(screen.getAllByText(/liên hệ quản trị viên/i).length).toBeGreaterThan(0)
        expect(screen.queryByText('manager@example.com')).toBeNull()
    })
})
