import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

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

describe('getAuthenticatedDashboardSession', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
    })

    it('returns the authenticated dashboard principal with the derived principal key', async () => {
        const getUser = vi.fn().mockResolvedValue({
            data: {
                user: {
                    id: 'staff-1',
                    last_sign_in_at: '2026-03-26T12:00:00.000Z',
                },
            },
        })
        const getSession = vi.fn().mockResolvedValue({
            data: {
                session: {
                    access_token: 'token-1',
                },
            },
        })
        const usersQuery = createUsersQuery({
            data: {
                full_name: 'Manager A',
                role: 'manager',
                can_access_confidential: false,
            },
            error: null,
        })

        mockCreateClient.mockResolvedValue({
            auth: {
                getUser,
                getSession,
            },
            from: (table: string) => {
                expect(table).toBe('users')
                return usersQuery
            },
        })

        const { getAuthenticatedDashboardSession } = await import('../dashboard-session')

        await expect(getAuthenticatedDashboardSession()).resolves.toEqual({
            accessToken: 'token-1',
            canAccessConfidential: false,
            fullName: 'Manager A',
            lastSignInAt: '2026-03-26T12:00:00.000Z',
            principalKey: 'staff-1:manager:standard',
            role: 'manager',
            userId: 'staff-1',
        })
    })

    it('accepts doctor as a dashboard role and includes it in the principal key', async () => {
        const getUser = vi.fn().mockResolvedValue({
            data: {
                user: {
                    id: 'doctor-1',
                    last_sign_in_at: '2026-04-09T12:00:00.000Z',
                },
            },
        })
        const getSession = vi.fn().mockResolvedValue({
            data: {
                session: {
                    access_token: 'token-2',
                },
            },
        })
        const usersQuery = createUsersQuery({
            data: {
                full_name: 'Doctor A',
                role: 'doctor',
                can_access_confidential: true,
            },
            error: null,
        })

        mockCreateClient.mockResolvedValue({
            auth: {
                getUser,
                getSession,
            },
            from: (table: string) => {
                expect(table).toBe('users')
                return usersQuery
            },
        })

        const { getAuthenticatedDashboardSession, isDashboardUserRole } = await import('../dashboard-session')

        expect(isDashboardUserRole('doctor')).toBe(true)
        await expect(getAuthenticatedDashboardSession()).resolves.toEqual({
            accessToken: 'token-2',
            canAccessConfidential: true,
            fullName: 'Doctor A',
            lastSignInAt: '2026-04-09T12:00:00.000Z',
            principalKey: 'doctor-1:doctor:confidential',
            role: 'doctor',
            userId: 'doctor-1',
        })
    })

    it('returns null when there is no authenticated user', async () => {
        const getUser = vi.fn().mockResolvedValue({
            data: {
                user: null,
            },
        })

        mockCreateClient.mockResolvedValue({
            auth: {
                getUser,
                getSession: vi.fn().mockResolvedValue({
                    data: {
                        session: null,
                    },
                }),
            },
            from: vi.fn(),
        })

        const { getAuthenticatedDashboardSession } = await import('../dashboard-session')

        await expect(getAuthenticatedDashboardSession()).resolves.toBeNull()
        expect(mockCreateClient).toHaveBeenCalledTimes(1)
        expect(getUser).toHaveBeenCalledTimes(1)
    })
})
