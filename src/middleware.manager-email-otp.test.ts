import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

function createRequest(pathname: string) {
    return new NextRequest(`http://localhost${pathname}`)
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

    it('redirects password-only manager sessions away from /manager until OTP step-up succeeds', async () => {
        mockPasswordOnlyManagerSession()

        const response = await middleware(createRequest('/manager'))
        const location = response.headers.get('location')

        expect(location).not.toBeNull()
        expect(new URL(location ?? '').pathname).toBe('/manager/otp')
    })
})
