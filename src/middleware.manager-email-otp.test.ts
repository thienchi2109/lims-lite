import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGER_STEP_UP_COOKIE_NAME } from './lib/manager-email-otp/step-up'

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
            data: { role: 'manager', can_access_confidential: false },
            error: null,
        })),
    }

    mocks.createEdgeAdminClient.mockReturnValue({
        rpc: vi.fn(async () => ({
            data: new Date(Date.now()).toISOString(),
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

describe('manager email OTP middleware contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'TRUE'
        process.env.MANAGER_HIV_EMAIL_OTP_ENABLED = 'FALSE'
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
})
