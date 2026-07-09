import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getManagerOtpRouteContext: vi.fn(),
    getManagerOtpStepUpCohort: vi.fn(),
    verifyManagerOtpChallengeRecord: vi.fn(),
    createManagerStepUpCookieValue: vi.fn(async () => 'step-up-cookie'),
}))

vi.mock('@/lib/manager-email-otp/server-records', () => ({
    getManagerOtpRouteContext: (...args: unknown[]) => mocks.getManagerOtpRouteContext(...args),
    getManagerOtpStepUpCohort: (...args: unknown[]) => mocks.getManagerOtpStepUpCohort(...args),
    verifyManagerOtpChallengeRecord: (...args: unknown[]) => mocks.verifyManagerOtpChallengeRecord(...args),
}))

vi.mock('@/lib/manager-email-otp/step-up', () => ({
    createManagerStepUpCookieValue: (...args: unknown[]) => mocks.createManagerStepUpCookieValue(...args),
    getManagerStepUpCookieOptions: () => ({ httpOnly: true }),
    getManagerStepUpSecret: () => 'test-secret',
    MANAGER_STEP_UP_COOKIE_NAME: 'manager_otp_step_up',
}))

vi.mock('@/lib/auth-session-timebox', () => ({
    getSessionTimeboxSeconds: () => 3600,
}))

import { POST } from './route'

const validBody = {
    challengeId: '33333333-3333-4333-8333-333333333333',
    code: '123456',
}

describe('manager OTP verify route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getManagerOtpRouteContext.mockResolvedValue({
            ok: true,
            userId: '11111111-1111-4111-8111-111111111111',
            sessionId: 'session-1',
            canAccessConfidential: false,
            otpEmail: 'manager@example.com',
            otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
            maskedEmail: 'ma***@example.com',
        })
        mocks.getManagerOtpStepUpCohort.mockReturnValue('standard')
        mocks.verifyManagerOtpChallengeRecord.mockResolvedValue({ ok: true })
    })

    it('rejects missing manager OTP cohort before consuming the challenge', async () => {
        mocks.getManagerOtpStepUpCohort.mockReturnValue(null)

        const response = await POST(new Request('http://localhost/api/manager/otp/verify', {
            method: 'POST',
            headers: { origin: 'http://localhost' },
            body: JSON.stringify(validBody),
        }))

        await expect(response.json()).resolves.toEqual({ ok: false, status: 'forbidden' })
        expect(response.status).toBe(403)
        expect(mocks.verifyManagerOtpChallengeRecord).not.toHaveBeenCalled()
    })

    it('sets a shared step-up cookie for analyst confidential OTP verification', async () => {
        mocks.getManagerOtpRouteContext.mockResolvedValue({
            ok: true,
            userId: 'analyst-hiv-1',
            role: 'analyst',
            sessionId: 'session-analyst-1',
            canAccessConfidential: true,
            otpEmail: 'analyst@example.com',
            otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
            maskedEmail: 'an***@example.com',
        })
        mocks.getManagerOtpStepUpCohort.mockReturnValue('analyst-confidential')

        const response = await POST(new Request('http://localhost/api/manager/otp/verify', {
            method: 'POST',
            headers: { origin: 'http://localhost' },
            body: JSON.stringify(validBody),
        }))

        expect(response.status).toBe(200)
        expect(mocks.verifyManagerOtpChallengeRecord).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'analyst-hiv-1' }),
            validBody,
        )
        expect(mocks.createManagerStepUpCookieValue).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'analyst-hiv-1',
            sessionId: 'session-analyst-1',
            cohort: 'analyst-confidential',
            otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
        }))
    })
})
