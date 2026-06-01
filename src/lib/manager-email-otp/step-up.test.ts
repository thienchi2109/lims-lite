import { createHmac } from 'crypto'
import { describe, expect, it } from 'vitest'

import {
    createManagerStepUpCookieValue,
    getManagerStepUpSecret,
    verifyManagerStepUpCookieValue,
} from './step-up'

const baseInput = {
    userId: 'manager-1',
    sessionId: 'session-1',
    cohort: 'standard' as const,
    otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
    expiresAt: new Date('2026-06-01T04:00:00.000Z'),
    secret: ['unit', 'step', 'up', 'fixture'].join(':'),
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

    it('rejects malformed signed payloads instead of treating them as valid', () => {
        const payload = Buffer.from(
            JSON.stringify({
                userId: 'manager-1',
                sessionId: 'session-1',
                cohort: 'standard',
                otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
                expiresAt: 'not-a-date',
            }),
            'utf8',
        ).toString('base64url')
        const signature = createHmac('sha256', baseInput.secret).update(payload).digest('base64url')

        expect(
            verifyManagerStepUpCookieValue(`${payload}.${signature}`, {
                ...baseInput,
                now: new Date('2026-06-01T01:00:00.000Z'),
            }),
        ).toEqual({ ok: false, reason: 'invalid' })
    })

    it('fails fast in production when no step-up signing secret is configured', () => {
        const originalEnv = { ...process.env }
        try {
            delete process.env.MANAGER_OTP_STEP_UP_SECRET
            delete process.env.JWT_SECRET
            process.env.NODE_ENV = 'production'

            expect(() => getManagerStepUpSecret()).toThrow(/MANAGER_OTP_STEP_UP_SECRET|JWT_SECRET/)
        } finally {
            process.env = originalEnv
        }
    })
})
