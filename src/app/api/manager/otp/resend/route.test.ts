import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getManagerOtpRouteContext: vi.fn(),
    resendManagerOtpChallengeRecord: vi.fn(),
    restoreManagerOtpChallengeRecord: vi.fn(),
    sendOtp: vi.fn(),
}))

vi.mock('@/lib/manager-email-otp/server-records', () => ({
    getManagerOtpRouteContext: (...args: unknown[]) => mocks.getManagerOtpRouteContext(...args),
    resendManagerOtpChallengeRecord: (...args: unknown[]) => mocks.resendManagerOtpChallengeRecord(...args),
    restoreManagerOtpChallengeRecord: (...args: unknown[]) => mocks.restoreManagerOtpChallengeRecord(...args),
}))

vi.mock('@/lib/manager-email-otp/delivery', () => ({
    createManagerOtpEmailDelivery: () => ({
        sendOtp: (...args: unknown[]) => mocks.sendOtp(...args),
    }),
}))

import { POST } from './route'

const requestBody = { challengeId: '33333333-3333-4333-8333-333333333333' }

describe('manager OTP resend route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getManagerOtpRouteContext.mockResolvedValue({
            ok: true,
            userId: 'manager-1',
            sessionId: 'session-1',
            otpEmail: 'manager@example.com',
            maskedEmail: 'ma***@example.com',
        })
        mocks.resendManagerOtpChallengeRecord.mockResolvedValue({
            ok: true,
            plainCode: '123456',
            challenge: {
                id: requestBody.challengeId,
                expires_at: '2026-06-02T04:05:00.000Z',
                resend_available_at: '2026-06-02T04:01:00.000Z',
            },
            rollback: {
                id: requestBody.challengeId,
                code_hash: 'old-hash',
                expires_at: '2026-06-02T04:00:00.000Z',
                attempt_count: 0,
                resend_available_at: '2026-06-02T04:00:00.000Z',
            },
        })
        mocks.sendOtp.mockResolvedValue({ ok: true })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('derives the delivery expiration window from the challenge expiry', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-02T04:00:59.000Z'))

        await POST(new Request('http://localhost/api/manager/otp/resend', {
            method: 'POST',
            headers: { origin: 'http://localhost' },
            body: JSON.stringify(requestBody),
        }))

        expect(mocks.sendOtp).toHaveBeenCalledWith(expect.objectContaining({
            expiresInMinutes: 4,
        }))
    })

    it('returns 429 when resend is still in cooldown', async () => {
        mocks.resendManagerOtpChallengeRecord.mockResolvedValue({
            ok: false,
            status: 'cooldown',
        })

        const response = await POST(new Request('http://localhost/api/manager/otp/resend', {
            method: 'POST',
            headers: { origin: 'http://localhost' },
            body: JSON.stringify(requestBody),
        }))

        await expect(response.json()).resolves.toEqual({
            ok: false,
            status: 'cooldown',
            maskedEmail: 'ma***@example.com',
        })
        expect(response.status).toBe(429)
    })

    it('reports persistence failure when provider-error rollback fails', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.sendOtp.mockRejectedValue(new Error('provider timeout'))
        mocks.restoreManagerOtpChallengeRecord.mockRejectedValue(new Error('rollback failed'))

        try {
            const response = await POST(new Request('http://localhost/api/manager/otp/resend', {
                method: 'POST',
                headers: { origin: 'http://localhost' },
                body: JSON.stringify(requestBody),
            }))

            await expect(response.json()).resolves.toEqual({
                ok: false,
                status: 'persist_failed',
                maskedEmail: 'ma***@example.com',
            })
            expect(response.status).toBe(500)
        } finally {
            consoleError.mockRestore()
        }
    })

    it('logs a sanitized provider failure without OTP or email values', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.sendOtp.mockRejectedValue(new Error('provider timeout for 123456 manager@example.com'))
        mocks.restoreManagerOtpChallengeRecord.mockResolvedValue(undefined)

        try {
            const response = await POST(new Request('http://localhost/api/manager/otp/resend', {
                method: 'POST',
                headers: { origin: 'http://localhost' },
                body: JSON.stringify(requestBody),
            }))

            expect(response.status).toBe(503)
            expect(consoleError).toHaveBeenCalledWith('Manager OTP resend delivery failed', {
                status: 'provider_failed',
            })
            const loggedText = JSON.stringify(consoleError.mock.calls)
            expect(loggedText).not.toContain('123456')
            expect(loggedText).not.toContain('manager@example.com')
        } finally {
            consoleError.mockRestore()
        }
    })
})
