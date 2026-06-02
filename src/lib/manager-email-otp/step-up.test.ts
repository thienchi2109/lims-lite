import { createHmac } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
    afterEach(() => {
        vi.unstubAllEnvs()
    })

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
        vi.stubEnv('MANAGER_OTP_STEP_UP_SECRET', undefined)
        vi.stubEnv('JWT_SECRET', undefined)
        vi.stubEnv('NODE_ENV', 'production')

        expect(() => getManagerStepUpSecret()).toThrow(/MANAGER_OTP_STEP_UP_SECRET|JWT_SECRET/)
    })
})
