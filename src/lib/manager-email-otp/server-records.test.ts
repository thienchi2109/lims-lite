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
    delete?: ReturnType<typeof vi.fn>
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
            p_session_id: 'session-1',
            p_user_id: '11111111-1111-4111-8111-111111111111',
        })
        expect(challengeQuery.update).not.toHaveBeenCalled()
    })

    it('delegates challenge creation to the database RPC so eligibility and insert are atomic', async () => {
        const rpc = vi.fn(async () => ({
            data: {
                ok: true,
                challenge: {
                    id: '33333333-3333-4333-8333-333333333333',
                    expires_at: '2026-06-02T04:05:00.000Z',
                    resend_available_at: '2026-06-02T04:01:00.000Z',
                },
            },
            error: null,
        }))
        const from = vi.fn()
        mocks.createAdminClient.mockReturnValue({ from, rpc })

        const { createManagerOtpChallengeRecord } = await import('./server-records')

        const result = await createManagerOtpChallengeRecord(context)

        expect(result.ok).toBe(true)
        expect(rpc).toHaveBeenCalledWith('create_manager_otp_challenge', expect.objectContaining({
            p_challenge_id: expect.any(String),
            p_code_hash: expect.any(String),
            p_session_id: 'session-1',
            p_user_id: '11111111-1111-4111-8111-111111111111',
        }))
        expect(from).not.toHaveBeenCalled()
    })

    it('does not create a fresh challenge when the active challenge is locked', async () => {
        const rpc = vi.fn(async () => ({
            data: {
                ok: false,
                status: 'locked',
                challenge: {
                    id: '33333333-3333-4333-8333-333333333333',
                    expires_at: '2026-06-02T04:05:00.000Z',
                    resend_available_at: '2026-06-02T04:01:00.000Z',
                },
            },
            error: null,
        }))
        mocks.createAdminClient.mockReturnValue({ rpc })

        const { createManagerOtpChallengeRecord } = await import('./server-records')

        await expect(createManagerOtpChallengeRecord(context)).resolves.toEqual({
            ok: false,
            status: 'locked',
            challenge: {
                id: '33333333-3333-4333-8333-333333333333',
                expires_at: '2026-06-02T04:05:00.000Z',
                resend_available_at: '2026-06-02T04:01:00.000Z',
            },
        })
    })

    it('throws when provider-failure cleanup cannot delete the challenge', async () => {
        const query = {
            eq: vi.fn(async () => ({ error: { message: 'delete failed' } })),
        }
        mocks.createAdminClient.mockReturnValue({
            from: vi.fn(() => ({
                delete: vi.fn(() => query),
            })),
        })

        const { deleteManagerOtpChallengeRecord } = await import('./server-records')

        await expect(deleteManagerOtpChallengeRecord('33333333-3333-4333-8333-333333333333'))
            .rejects.toThrow('delete failed')
    })

    it('throws when provider-failure rollback cannot restore the previous challenge', async () => {
        const query = {
            eq: vi.fn(async () => ({ error: { message: 'rollback failed' } })),
        }
        mocks.createAdminClient.mockReturnValue({
            from: vi.fn(() => ({
                update: vi.fn(() => query),
            })),
        })

        const { restoreManagerOtpChallengeRecord } = await import('./server-records')

        await expect(restoreManagerOtpChallengeRecord({
            id: '33333333-3333-4333-8333-333333333333',
            code_hash: 'old-hash',
            expires_at: '2026-06-02T04:00:00.000Z',
            attempt_count: 0,
            resend_available_at: '2026-06-02T04:00:00.000Z',
        })).rejects.toThrow('rollback failed')
    })
})
