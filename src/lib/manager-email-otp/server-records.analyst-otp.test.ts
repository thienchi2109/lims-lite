import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

function encodeJwtPayload(payload: Record<string, unknown>) {
    return ['header', Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url'), 'signature'].join('.')
}

describe('analyst HIV OTP server records', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('ANALYST_HIV_EMAIL_OTP_ENABLED', 'TRUE')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('builds OTP route context for confidential analysts only when analyst HIV OTP is enabled', async () => {
        const usersQuery = {
            select: vi.fn(() => usersQuery),
            eq: vi.fn(() => usersQuery),
            single: vi.fn(async () => ({
                data: {
                    role: 'analyst',
                    can_access_confidential: true,
                    manager_otp_settings: {
                        otp_email: 'analyst@example.com',
                        updated_at: '2026-06-01T00:00:00.000Z',
                    },
                },
                error: null,
            })),
        }
        mocks.createClient.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: { id: 'analyst-hiv-1' } },
                    error: null,
                })),
                getSession: vi.fn(async () => ({
                    data: {
                        session: {
                            access_token: encodeJwtPayload({ session_id: 'session-analyst-1' }),
                        },
                    },
                    error: null,
                })),
            },
            from: vi.fn(() => usersQuery),
        })

        const { getManagerOtpRouteContext } = await import('./server-records')

        await expect(getManagerOtpRouteContext()).resolves.toEqual({
            ok: true,
            userId: 'analyst-hiv-1',
            role: 'analyst',
            sessionId: 'session-analyst-1',
            canAccessConfidential: true,
            otpEmail: 'analyst@example.com',
            otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
            maskedEmail: 'an***@example.com',
        })
    })
})
