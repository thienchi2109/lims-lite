import { createHmac } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
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

    it('keeps the step-up helper compatible with Edge middleware imports', () => {
        const source = readFileSync(join(process.cwd(), 'src/lib/manager-email-otp/step-up.ts'), 'utf8')

        expect(source).not.toMatch(/from ['"](?:node:)?crypto['"]/)
        expect(source).not.toMatch(/\bBuffer\b/)
    })

    it('accepts a signed cookie tied to the authenticated user and session', async () => {
        const cookieValue = await createManagerStepUpCookieValue(baseInput)

        expect(
            await verifyManagerStepUpCookieValue(cookieValue, {
                ...baseInput,
                now: new Date('2026-06-01T01:00:00.000Z'),
            }),
        ).toEqual({ ok: true })
    })

    it('preserves the legacy Node HMAC signature format', async () => {
        const cookieValue = await createManagerStepUpCookieValue(baseInput)
        const [payload, signature] = cookieValue.split('.')

        expect(signature).toBe(createHmac('sha256', baseInput.secret).update(payload ?? '').digest('base64url'))
    })

    it('rejects expired, wrong-session, and OTP-email-change cookies', async () => {
        const cookieValue = await createManagerStepUpCookieValue(baseInput)

        expect(
            await verifyManagerStepUpCookieValue(cookieValue, {
                ...baseInput,
                now: new Date('2026-06-01T04:00:01.000Z'),
            }),
        ).toEqual({ ok: false, reason: 'expired' })

        expect(
            await verifyManagerStepUpCookieValue(cookieValue, {
                ...baseInput,
                sessionId: 'session-2',
                now: new Date('2026-06-01T01:00:00.000Z'),
            }),
        ).toEqual({ ok: false, reason: 'mismatch' })

        expect(
            await verifyManagerStepUpCookieValue(cookieValue, {
                ...baseInput,
                otpEmailUpdatedAt: '2026-06-01T02:00:00.000Z',
                now: new Date('2026-06-01T01:00:00.000Z'),
            }),
        ).toEqual({ ok: false, reason: 'mismatch' })
    })

    it('rejects malformed signed payloads instead of treating them as valid', async () => {
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
            await verifyManagerStepUpCookieValue(`${payload}.${signature}`, {
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
