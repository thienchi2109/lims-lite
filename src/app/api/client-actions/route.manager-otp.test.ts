import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createManagerStepUpCookieValue, MANAGER_STEP_UP_COOKIE_NAME } from '@/lib/manager-email-otp/step-up'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

import { getClientActionDenial } from './role-guard'

const originalEnv = { ...process.env }
const stepUpFixtureSecret = ['client', 'action', 'step', 'up'].join(':')

function mockPasswordOnlyManager() {
    const usersQuery = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: { role: 'manager', can_access_confidential: false },
            error: null,
        })),
    }

    mocks.createClient.mockResolvedValue({
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: 'manager-1' } },
                error: null,
            })),
        },
        from: vi.fn(() => usersQuery),
    })
}

function encodeJwtPayload(payload: Record<string, unknown>) {
    return ['header', Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url'), 'signature'].join('.')
}

function mockSteppedUpManager() {
    const usersQuery = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: {
                role: 'manager',
                can_access_confidential: false,
                manager_otp_settings: { updated_at: '2026-06-01T00:00:00.000Z' },
            },
            error: null,
        })),
    }

    mocks.createClient.mockResolvedValue({
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: 'manager-1' } },
                error: null,
            })),
            getSession: vi.fn(async () => ({
                data: {
                    session: {
                        access_token: encodeJwtPayload({ session_id: 'session-1' }),
                    },
                },
                error: null,
            })),
        },
        from: vi.fn(() => usersQuery),
    })
}

describe('manager email OTP client action guard contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'TRUE'
        process.env.MANAGER_HIV_EMAIL_OTP_ENABLED = 'FALSE'
        process.env.MANAGER_OTP_STEP_UP_SECRET = stepUpFixtureSecret
    })

    afterEach(() => {
        process.env = { ...originalEnv }
    })

    it('denies manager-only client actions for password-only manager sessions when OTP is enabled', async () => {
        mockPasswordOnlyManager()

        await expect(getClientActionDenial('createUser')).resolves.toEqual({
            error: 'Yêu cầu xác thực OTP email quản lý trước khi tiếp tục',
            status: 403,
        })
    })

    it('denies shared client actions for password-only manager sessions when OTP is enabled', async () => {
        mockPasswordOnlyManager()

        await expect(getClientActionDenial('getSamples')).resolves.toEqual({
            error: 'Yêu cầu xác thực OTP email quản lý trước khi tiếp tục',
            status: 403,
        })
    })

    it('allows shared client actions for manager cohorts when OTP enforcement is disabled', async () => {
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'FALSE'
        mockPasswordOnlyManager()

        await expect(getClientActionDenial('getSamples')).resolves.toBeNull()
    })

    it('allows manager-only client actions when the request has a valid manager step-up cookie', async () => {
        mockSteppedUpManager()
        const cookieValue = createManagerStepUpCookieValue({
            userId: 'manager-1',
            sessionId: 'session-1',
            cohort: 'standard',
            otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            secret: stepUpFixtureSecret,
        })
        const request = new Request('http://localhost/api/client-actions', {
            headers: {
                cookie: `${MANAGER_STEP_UP_COOKIE_NAME}=${cookieValue}`,
            },
        })

        await expect(getClientActionDenial('createUser', request)).resolves.toBeNull()
    })

    it('handles malformed cookie percent-encoding without crashing the guard', async () => {
        mockSteppedUpManager()
        const request = new Request('http://localhost/api/client-actions', {
            headers: {
                cookie: `${MANAGER_STEP_UP_COOKIE_NAME}=%E0%A4%A`,
            },
        })

        await expect(getClientActionDenial('createUser', request)).resolves.toEqual({
            error: 'Yêu cầu xác thực OTP email quản lý trước khi tiếp tục',
            status: 403,
        })
    })
})
