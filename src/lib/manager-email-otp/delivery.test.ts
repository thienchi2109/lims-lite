import { describe, expect, it, vi } from 'vitest'

import {
    createManagerOtpEmailDelivery,
    renderManagerOtpEmail,
} from './delivery'

describe('manager OTP email delivery contract', () => {
    it('renders Vietnamese OTP email content without leaking provider details', () => {
        const message = renderManagerOtpEmail({
            code: '123456',
            expiresInMinutes: 5,
        })

        expect(message.subject).toContain('Mã xác thực')
        expect(message.text).toContain('123456')
        expect(message.text).toContain('5 phút')
        expect(message.html).toContain('123456')
    })

    it('rejects the non-sending adapter in production', () => {
        expect(() =>
            createManagerOtpEmailDelivery({
                provider: 'noop',
                nodeEnv: 'production',
            }),
        ).toThrow(/không được dùng noop/i)
    })

    it('uses Resend as the default production provider', () => {
        const originalEnv = { ...process.env }
        try {
            delete process.env.MANAGER_OTP_EMAIL_PROVIDER
            process.env.RESEND_API_KEY = ''
            process.env.MANAGER_OTP_EMAIL_FROM = 'CDC-LIMS <otp@send.cdclims.cloud>'

            expect(() =>
                createManagerOtpEmailDelivery({
                    nodeEnv: 'production',
                }),
            ).toThrow(/RESEND_API_KEY/)
        } finally {
            process.env = originalEnv
        }
    })

    it('sends through the Resend provider adapter with configured sender fields', async () => {
        const send = vi.fn(async () => ({ data: { id: 'email-1' }, error: null }))
        const delivery = createManagerOtpEmailDelivery({
            provider: 'resend',
            apiKey: 're_test',
            from: 'CDC-LIMS <otp@send.cdclims.cloud>',
            replyTo: 'no-reply@send.cdclims.cloud',
            resendClient: { emails: { send } },
        })

        await expect(
            delivery.sendOtp({
                to: 'manager@example.com',
                code: '123456',
                expiresInMinutes: 5,
            }),
        ).resolves.toEqual({ ok: true, providerMessageId: 'email-1' })

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'CDC-LIMS <otp@send.cdclims.cloud>',
                to: ['manager@example.com'],
                replyTo: 'no-reply@send.cdclims.cloud',
                subject: expect.stringContaining('Mã xác thực'),
            }),
        )
    })

    it('returns provider_failed when the Resend adapter rejects', async () => {
        const providerError = new Error('network down')
        const delivery = createManagerOtpEmailDelivery({
            provider: 'resend',
            apiKey: 're_test',
            from: 'CDC-LIMS <otp@send.cdclims.cloud>',
            resendClient: {
                emails: {
                    send: vi.fn(async () => {
                        throw providerError
                    }),
                },
            },
        })

        await expect(
            delivery.sendOtp({
                to: 'manager@example.com',
                code: '123456',
                expiresInMinutes: 5,
            }),
        ).resolves.toEqual({ ok: false, reason: 'provider_failed', error: providerError })
    })
})
