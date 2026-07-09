import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagerStepUpCookieValue, MANAGER_STEP_UP_COOKIE_NAME } from './lib/manager-email-otp/step-up'

const mocks = vi.hoisted(() => ({
    createServerClient: vi.fn(),
    createEdgeAdminClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
    createServerClient: (...args: unknown[]) => mocks.createServerClient(...args),
}))

vi.mock('@/lib/auth-session-timebox', () => ({
    getSessionTimeboxSeconds: () => 3600,
}))

vi.mock('@/lib/jwt', () => ({
    decodeJwtPayload: () => ({ session_id: 'session-1' }),
}))

vi.mock('@/lib/supabase/edge-admin', () => ({
    createEdgeAdminClient: (...args: unknown[]) => mocks.createEdgeAdminClient(...args),
}))

import { middleware } from './middleware'

const originalEnv = { ...process.env }
const otpEmailUpdatedAt = '2026-06-01T00:00:00.000Z'

function createRequest(pathname: string, cookie?: string) {
    return new NextRequest(`http://localhost${pathname}`, {
        headers: cookie ? { cookie } : undefined,
    })
}

function mockPasswordOnlyManagerSession() {
    const usersQuery = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: {
                role: 'manager',
                can_access_confidential: false,
                manager_otp_settings: { updated_at: otpEmailUpdatedAt },
            },
            error: null,
        })),
    }

    mocks.createEdgeAdminClient.mockReturnValue({
        rpc: vi.fn(async (fnName: string) => ({
            data: fnName === 'get_session_created_at'
                ? new Date(Date.now()).toISOString()
                : otpEmailUpdatedAt,
            error: null,
        })),
    })

    mocks.createServerClient.mockReturnValue({
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: 'manager-1', last_sign_in_at: new Date(Date.now()).toISOString() } },
                error: null,
            })),
            getSession: vi.fn(async () => ({
                data: { session: { access_token: 'token' } },
                error: null,
            })),
            signOut: vi.fn(),
        },
        from: vi.fn(() => usersQuery),
    })
}

function mockPasswordOnlyAnalystSession(canAccessConfidential: boolean) {
    const usersQuery = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: {
                role: 'analyst',
                can_access_confidential: canAccessConfidential,
                manager_otp_settings: { updated_at: otpEmailUpdatedAt },
            },
            error: null,
        })),
    }

    mocks.createEdgeAdminClient.mockReturnValue({
        rpc: vi.fn(async (fnName: string) => ({
            data: fnName === 'get_session_created_at'
                ? new Date(Date.now()).toISOString()
                : otpEmailUpdatedAt,
            error: null,
        })),
    })

    mocks.createServerClient.mockReturnValue({
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: 'analyst-1', last_sign_in_at: new Date(Date.now()).toISOString() } },
                error: null,
            })),
            getSession: vi.fn(async () => ({
                data: { session: { access_token: 'token' } },
                error: null,
            })),
            signOut: vi.fn(),
        },
        from: vi.fn(() => usersQuery),
    })
}

describe('manager email OTP middleware contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'TRUE'
        process.env.MANAGER_HIV_EMAIL_OTP_ENABLED = 'FALSE'
        process.env.ANALYST_HIV_EMAIL_OTP_ENABLED = 'FALSE'
    })

    afterEach(() => {
        process.env = { ...originalEnv }
    })

    it('redirects password-only manager sessions away from /manager until OTP step-up succeeds', async () => {
        mockPasswordOnlyManagerSession()

        const response = await middleware(createRequest('/manager'))
        const location = response.headers.get('location')

        expect(location).not.toBeNull()
        expect(new URL(location ?? '').pathname).toBe('/manager/otp')
    })

    it('clears stale manager step-up cookies when redirecting back to OTP verification', async () => {
        mockPasswordOnlyManagerSession()

        const response = await middleware(createRequest('/manager', `${MANAGER_STEP_UP_COOKIE_NAME}=stale-cookie`))

        expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/manager/otp')
        expect(response.headers.get('set-cookie')).toContain(`${MANAGER_STEP_UP_COOKIE_NAME}=;`)
        expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    })

    it('allows manager routes when the step-up cookie is valid for the current session', async () => {
        mockPasswordOnlyManagerSession()
        const cookieValue = await createManagerStepUpCookieValue({
            userId: 'manager-1',
            sessionId: 'session-1',
            cohort: 'standard',
            otpEmailUpdatedAt,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            secret: 'middleware-step-up-secret',
        })
        process.env.MANAGER_OTP_STEP_UP_SECRET = 'middleware-step-up-secret'

        const response = await middleware(createRequest('/manager', `${MANAGER_STEP_UP_COOKIE_NAME}=${cookieValue}`))

        expect(response.headers.get('location')).toBeNull()
        expect(response.headers.get('set-cookie') ?? '').not.toContain(`${MANAGER_STEP_UP_COOKIE_NAME}=;`)
    })

    it('redirects password-only confidential analyst sessions away from /analyst when analyst HIV OTP is enabled', async () => {
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'FALSE'
        process.env.MANAGER_HIV_EMAIL_OTP_ENABLED = 'FALSE'
        process.env.ANALYST_HIV_EMAIL_OTP_ENABLED = 'TRUE'
        mockPasswordOnlyAnalystSession(true)

        const response = await middleware(createRequest('/analyst'))
        const location = response.headers.get('location')

        expect(location).not.toBeNull()
        expect(new URL(location ?? '').pathname).toBe('/manager/otp')
    })

    it('allows standard analysts without OTP even when analyst HIV OTP is enabled', async () => {
        process.env.ANALYST_HIV_EMAIL_OTP_ENABLED = 'TRUE'
        mockPasswordOnlyAnalystSession(false)

        const response = await middleware(createRequest('/analyst'))

        expect(response.headers.get('location')).toBeNull()
    })
})
