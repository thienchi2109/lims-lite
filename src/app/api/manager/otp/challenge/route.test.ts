import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getManagerOtpRouteContext: vi.fn(),
    createManagerOtpChallengeRecord: vi.fn(),
    deleteManagerOtpChallengeRecord: vi.fn(),
    sendOtp: vi.fn(),
}))

vi.mock('@/lib/manager-email-otp/server-records', () => ({
    getManagerOtpRouteContext: (...args: unknown[]) => mocks.getManagerOtpRouteContext(...args),
    createManagerOtpChallengeRecord: (...args: unknown[]) => mocks.createManagerOtpChallengeRecord(...args),
    deleteManagerOtpChallengeRecord: (...args: unknown[]) => mocks.deleteManagerOtpChallengeRecord(...args),
}))

vi.mock('@/lib/manager-email-otp/delivery', () => ({
    createManagerOtpEmailDelivery: () => ({
        sendOtp: (...args: unknown[]) => mocks.sendOtp(...args),
    }),
}))

import { POST } from './route'

describe('manager OTP challenge route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getManagerOtpRouteContext.mockResolvedValue({
            ok: true,
            userId: 'manager-1',
            sessionId: 'session-1',
            otpEmail: 'manager@example.com',
            maskedEmail: 'ma***@example.com',
        })
        mocks.createManagerOtpChallengeRecord.mockResolvedValue({
            ok: true,
            plainCode: '123456',
            challenge: {
                id: '33333333-3333-4333-8333-333333333333',
                expires_at: '2026-06-02T04:05:00.000Z',
                resend_available_at: '2026-06-02T04:01:00.000Z',
            },
        })
    })

    it('deletes the created challenge when delivery throws', async () => {
        mocks.sendOtp.mockRejectedValue(new Error('provider timeout'))

        const response = await POST(new Request('http://localhost/api/manager/otp/challenge', {
            method: 'POST',
            headers: { origin: 'http://localhost' },
        }))

        await expect(response.json()).resolves.toEqual({
            ok: false,
            status: 'provider_failed',
            maskedEmail: 'ma***@example.com',
        })
        expect(response.status).toBe(503)
        expect(mocks.deleteManagerOtpChallengeRecord).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333')
    })

    it('rejects POST requests without an Origin header', async () => {
        const response = await POST(new Request('http://localhost/api/manager/otp/challenge', {
            method: 'POST',
        }))

        await expect(response.json()).resolves.toEqual({ ok: false, status: 'invalid_origin' })
        expect(response.status).toBe(403)
        expect(mocks.createManagerOtpChallengeRecord).not.toHaveBeenCalled()
    })

    it('accepts same-origin requests when the public origin comes from proxy headers', async () => {
        mocks.sendOtp.mockResolvedValue({ ok: true })

        const response = await POST(new Request('http://0.0.0.0:3000/api/manager/otp/challenge', {
            method: 'POST',
            headers: {
                origin: 'https://cdclims.cloud',
                'x-forwarded-proto': 'https',
                'x-forwarded-host': 'cdclims.cloud',
            },
        }))

        expect(response.status).toBe(200)
        expect(mocks.createManagerOtpChallengeRecord).toHaveBeenCalled()
        expect(mocks.sendOtp).toHaveBeenCalledWith(expect.objectContaining({
            to: 'manager@example.com',
            code: '123456',
        }))
    })

    it('accepts same-origin requests when nginx forwards the public host without forwarded-host', async () => {
        mocks.sendOtp.mockResolvedValue({ ok: true })

        const response = await POST(new Request('http://app:3000/api/manager/otp/challenge', {
            method: 'POST',
            headers: {
                origin: 'https://cdclims.cloud',
                host: 'cdclims.cloud',
                'x-forwarded-proto': 'http',
            },
        }))

        expect(response.status).toBe(200)
        expect(mocks.createManagerOtpChallengeRecord).toHaveBeenCalled()
        expect(mocks.sendOtp).toHaveBeenCalled()
    })

    it('rejects requests when the origin host does not match the public host', async () => {
        const response = await POST(new Request('http://app:3000/api/manager/otp/challenge', {
            method: 'POST',
            headers: {
                origin: 'https://example.test',
                host: 'cdclims.cloud',
                'x-forwarded-proto': 'http',
            },
        }))

        await expect(response.json()).resolves.toEqual({ ok: false, status: 'invalid_origin' })
        expect(response.status).toBe(403)
        expect(mocks.createManagerOtpChallengeRecord).not.toHaveBeenCalled()
    })

    it('reports persistence failure when provider-error cleanup fails', async () => {
        mocks.sendOtp.mockRejectedValue(new Error('provider timeout'))
        mocks.deleteManagerOtpChallengeRecord.mockRejectedValue(new Error('delete failed'))

        const response = await POST(new Request('http://localhost/api/manager/otp/challenge', {
            method: 'POST',
            headers: { origin: 'http://localhost' },
        }))

        await expect(response.json()).resolves.toEqual({
            ok: false,
            status: 'persist_failed',
            maskedEmail: 'ma***@example.com',
        })
        expect(response.status).toBe(500)
    })
})
