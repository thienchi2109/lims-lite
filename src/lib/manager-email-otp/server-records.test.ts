import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createAdminClient: vi.fn(),
    createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args),
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

vi.mock('@/lib/manager-email-otp/guards', () => ({
    getManagerOtpCohort: () => 'standard',
}))

type Query = {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
}

const context = {
    ok: true,
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: 'session-1',
    canAccessConfidential: false,
    otpEmail: 'manager@example.com',
    otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
    maskedEmail: 'ma***@example.com',
} as const

function createChallengeQuery(challenge: unknown): Query {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn(async () => ({ data: challenge, error: null })),
        update: vi.fn(() => query),
    }
    return query
}

describe('manager OTP server records', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('delegates verification to the database RPC after confirming challenge ownership', async () => {
        const challengeQuery = createChallengeQuery({
            id: '33333333-3333-4333-8333-333333333333',
            code_hash: 'stored-hash',
            expires_at: '2026-06-02T04:05:00.000Z',
            used_at: null,
            locked_at: null,
            attempt_count: 0,
            resend_available_at: '2026-06-02T04:01:00.000Z',
        })
        const rpc = vi.fn(async () => ({
            data: { ok: true, status: 'verified' },
            error: null,
        }))
        mocks.createAdminClient.mockReturnValue({
            from: vi.fn(() => challengeQuery),
            rpc,
        })

        const { verifyManagerOtpChallengeRecord } = await import('./server-records')

        await expect(verifyManagerOtpChallengeRecord(context, {
            challengeId: '33333333-3333-4333-8333-333333333333',
            code: '123456',
        })).resolves.toEqual({ ok: true })
        expect(rpc).toHaveBeenCalledWith('verify_manager_otp_challenge', {
            p_challenge_id: '33333333-3333-4333-8333-333333333333',
            p_code: '123456',
        })
        expect(challengeQuery.update).not.toHaveBeenCalled()
    })
})
