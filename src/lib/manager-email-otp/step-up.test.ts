import { describe, expect, it } from 'vitest'

import {
    createManagerStepUpCookieValue,
    verifyManagerStepUpCookieValue,
} from './step-up'

const baseInput = {
    userId: 'manager-1',
    sessionId: 'session-1',
    cohort: 'standard' as const,
    otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
    expiresAt: new Date('2026-06-01T04:00:00.000Z'),
    secret: 'test-secret',
}

describe('manager OTP step-up cookie contract', () => {
    it('accepts a signed cookie tied to the authenticated user and session', () => {
        const cookieValue = createManagerStepUpCookieValue(baseInput)

        expect(
            verifyManagerStepUpCookieValue(cookieValue, {
                ...baseInput,
                now: new Date('2026-06-01T01:00:00.000Z'),
            }),
        ).toEqual({ ok: true })
    })

    it('rejects expired, wrong-session, and OTP-email-change cookies', () => {
        const cookieValue = createManagerStepUpCookieValue(baseInput)

        expect(
            verifyManagerStepUpCookieValue(cookieValue, {
                ...baseInput,
                now: new Date('2026-06-01T04:00:01.000Z'),
            }),
        ).toEqual({ ok: false, reason: 'expired' })

        expect(
            verifyManagerStepUpCookieValue(cookieValue, {
                ...baseInput,
                sessionId: 'session-2',
                now: new Date('2026-06-01T01:00:00.000Z'),
            }),
        ).toEqual({ ok: false, reason: 'mismatch' })

        expect(
            verifyManagerStepUpCookieValue(cookieValue, {
                ...baseInput,
                otpEmailUpdatedAt: '2026-06-01T02:00:00.000Z',
                now: new Date('2026-06-01T01:00:00.000Z'),
            }),
        ).toEqual({ ok: false, reason: 'mismatch' })
    })
})
