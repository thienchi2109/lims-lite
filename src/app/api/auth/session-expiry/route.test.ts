import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockDecodeJwtPayload = vi.fn()
const mockGetSessionTimeboxSeconds = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

vi.mock('@/lib/jwt', () => ({
    decodeJwtPayload: (...args: unknown[]) => mockDecodeJwtPayload(...args),
}))

vi.mock('@/lib/auth-session-timebox', () => ({
    getSessionTimeboxSeconds: (...args: unknown[]) => mockGetSessionTimeboxSeconds(...args),
}))

import { GET } from './route'

function createUsersQuery(result: {
    data: unknown
    error: { message: string } | null
}) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn(async () => result),
    }

    return query
}

describe('GET /api/auth/session-expiry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCreateAdminClient.mockReturnValue({})
        mockDecodeJwtPayload.mockReturnValue(null)
        mockGetSessionTimeboxSeconds.mockReturnValue(14_400)
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('returns an authenticated=false error payload when the user profile lookup fails', async () => {
        mockCreateClient.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'staff-1' } },
                }),
                getSession: vi.fn().mockResolvedValue({
                    data: { session: null },
                }),
            },
            from: (table: string) => {
                if (table !== 'users') {
                    throw new Error(`Unexpected table: ${table}`)
                }

                return createUsersQuery({
                    data: null,
                    error: { message: 'lookup failed' },
                })
            },
        })

        const response = await GET()

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toEqual({
            authenticated: false,
            error: 'Không thể xác minh quyền truy cập hiện tại.',
        })
    })
})
