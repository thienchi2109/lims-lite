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
    is?: ReturnType<typeof vi.fn>
    gt?: ReturnType<typeof vi.fn>
    lte?: ReturnType<typeof vi.fn>
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

function createUpdateQuery(data: unknown, error: unknown = null): Query {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        gt: vi.fn(() => query),
        lte: vi.fn(() => query),
        single: vi.fn(async () => ({ data, error })),
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

    it('uses an English fallback error when challenge creation returns no row', async () => {
        mocks.createAdminClient.mockReturnValue({
            rpc: vi.fn(async () => ({ data: null, error: null })),
        })

        const { createManagerOtpChallengeRecord } = await import('./server-records')

        await expect(createManagerOtpChallengeRecord(context))
            .rejects.toThrow('Unable to create manager OTP challenge')
    })

    it('guards resend updates with eligibility predicates', async () => {
        const readQuery = createChallengeQuery({
            id: '33333333-3333-4333-8333-333333333333',
            code_hash: 'old-hash',
            expires_at: '2099-06-02T04:05:00.000Z',
            used_at: null,
            locked_at: null,
            attempt_count: 0,
            resend_available_at: '2026-06-02T04:00:00.000Z',
        })
        const updateQuery = createUpdateQuery(null)
        const from = vi.fn()
            .mockReturnValueOnce(readQuery)
            .mockReturnValueOnce(updateQuery)
        mocks.createAdminClient.mockReturnValue({ from })

        const { resendManagerOtpChallengeRecord } = await import('./server-records')

        await resendManagerOtpChallengeRecord(context, '33333333-3333-4333-8333-333333333333').catch(() => null)

        expect(updateQuery.eq).toHaveBeenCalledWith('id', '33333333-3333-4333-8333-333333333333')
        expect(updateQuery.eq).toHaveBeenCalledWith('user_id', '11111111-1111-4111-8111-111111111111')
        expect(updateQuery.eq).toHaveBeenCalledWith('session_id', 'session-1')
        expect(updateQuery.is).toHaveBeenCalledWith('used_at', null)
        expect(updateQuery.is).toHaveBeenCalledWith('locked_at', null)
        expect(updateQuery.gt).toHaveBeenCalledWith('expires_at', expect.any(String))
        expect(updateQuery.lte).toHaveBeenCalledWith('resend_available_at', expect.any(String))
    })

    it('maps stale resend update misses to the latest challenge status', async () => {
        const readQuery = createChallengeQuery({
            id: '33333333-3333-4333-8333-333333333333',
            code_hash: 'old-hash',
            expires_at: '2099-06-02T04:05:00.000Z',
            used_at: null,
            locked_at: null,
            attempt_count: 0,
            resend_available_at: '2026-06-02T04:00:00.000Z',
        })
        const updateQuery = createUpdateQuery(null, { code: 'PGRST116', message: 'No rows returned' })
        const staleReadQuery = createChallengeQuery({
            id: '33333333-3333-4333-8333-333333333333',
            code_hash: 'old-hash',
            expires_at: '2099-06-02T04:05:00.000Z',
            used_at: null,
            locked_at: '2026-06-02T04:01:00.000Z',
            attempt_count: 3,
            resend_available_at: '2026-06-02T04:00:00.000Z',
        })
        const from = vi.fn()
            .mockReturnValueOnce(readQuery)
            .mockReturnValueOnce(updateQuery)
            .mockReturnValueOnce(staleReadQuery)
        mocks.createAdminClient.mockReturnValue({ from })

        const { resendManagerOtpChallengeRecord } = await import('./server-records')

        await expect(resendManagerOtpChallengeRecord(context, '33333333-3333-4333-8333-333333333333'))
            .resolves.toEqual({ ok: false, status: 'locked' })
    })

    it('uses an English fallback error when resend update fails without a status change', async () => {
        const readQuery = createChallengeQuery({
            id: '33333333-3333-4333-8333-333333333333',
            code_hash: 'old-hash',
            expires_at: '2099-06-02T04:05:00.000Z',
            used_at: null,
            locked_at: null,
            attempt_count: 0,
            resend_available_at: '2026-06-02T04:00:00.000Z',
        })
        const updateQuery = createUpdateQuery(null, { code: 'PGRST116' })
        const unchangedReadQuery = createChallengeQuery({
            id: '33333333-3333-4333-8333-333333333333',
            code_hash: 'old-hash',
            expires_at: '2099-06-02T04:05:00.000Z',
            used_at: null,
            locked_at: null,
            attempt_count: 0,
            resend_available_at: '2026-06-02T04:00:00.000Z',
        })
        const from = vi.fn()
            .mockReturnValueOnce(readQuery)
            .mockReturnValueOnce(updateQuery)
            .mockReturnValueOnce(unchangedReadQuery)
        mocks.createAdminClient.mockReturnValue({ from })

        const { resendManagerOtpChallengeRecord } = await import('./server-records')

        await expect(resendManagerOtpChallengeRecord(context, '33333333-3333-4333-8333-333333333333'))
            .rejects.toThrow('Unable to resend manager OTP challenge')
    })
})
