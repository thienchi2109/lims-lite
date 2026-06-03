import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

type ManagerOtpChallenge = {
    id: string
    userId: string
    sessionId: string
    codeHash: string
    expiresAt: Date
    usedAt: Date | null
    lockedAt: Date | null
    attemptCount: number
    resendAvailableAt: Date
}

type CreateChallengeResult = {
    challenge: ManagerOtpChallenge
    plainCode: string
}

type VerifyChallengeResult =
    | { ok: true; stepUpSessionId: string }
    | { ok: false; reason: 'invalid_code' | 'expired' | 'used' | 'locked' }

type ChallengeStore = {
    savedChallenge: ManagerOtpChallenge | null
    savedChallenges?: Map<string, ManagerOtpChallenge>
    auditPayloads: unknown[]
}

type ChallengeModule = {
    createManagerOtpChallenge: (input: {
        userId: string
        sessionId: string
        now: Date
        store: ChallengeStore
    }) => Promise<CreateChallengeResult>
    verifyManagerOtpChallenge: (input: {
        challengeId: string
        code: string
        now: Date
        store: ChallengeStore
    }) => Promise<VerifyChallengeResult>
    resendManagerOtpChallenge: (input: {
        challengeId: string
        now: Date
        store: ChallengeStore
    }) => Promise<{ ok: true; plainCode: string } | { ok: false; reason: 'cooldown' | 'locked' | 'expired' | 'used' }>
}

async function loadChallengeContract() {
    const modulePath = './challenges'
    return import(modulePath) as Promise<ChallengeModule>
}

function createStore(): ChallengeStore {
    return {
        savedChallenge: null,
        savedChallenges: new Map(),
        auditPayloads: [],
    }
}

describe('manager email OTP challenge contract', () => {
    const rootDir = join(__dirname, '..', '..', '..')

    it('keeps TypeScript and database OTP attempt limits aligned', () => {
        const source = readFileSync(join(rootDir, 'src/lib/manager-email-otp/challenges.ts'), 'utf-8')
        const migration = readFileSync(
            join(rootDir, 'supabase/migrations/139_add_manager_otp_db_model.sql'),
            'utf-8'
        )

        const tsAttemptLimit = source.match(/const MAX_ATTEMPTS = (?<limit>\d+)/)?.groups?.limit
        const sqlAttemptLimit = migration.match(/v_attempt_count >= (?<limit>\d+)/)?.groups?.limit

        expect(sqlAttemptLimit).toBeDefined()
        expect(tsAttemptLimit).toBeDefined()
        expect(sqlAttemptLimit).toBe(tsAttemptLimit)
    })

    it('keeps the database verification RPC aligned with app hashing and audit requirements', () => {
        const migration = readFileSync(
            join(rootDir, 'supabase/migrations/140_harden_manager_otp_verification_rpc.sql'),
            'utf-8',
        )

        expect(migration).toContain("encode(digest(p_code, 'sha256'), 'hex')")
        expect(migration).toContain('FOR UPDATE')
        expect(migration).toContain('pg_advisory_xact_lock')
        expect(migration).toContain('MANAGER_OTP_VERIFY_SUCCESS')
        expect(migration).toContain('MANAGER_OTP_VERIFY_FAILED')
        expect(migration).toContain('MANAGER_OTP_VERIFY_EXPIRED')
        expect(migration).toContain('v_attempt_count >= 3')
        expect(migration).toContain('p_user_id IS NULL')
        expect(migration).toContain('DROP FUNCTION IF EXISTS public.create_manager_otp_challenge(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ)')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.verify_manager_otp_challenge(UUID, TEXT, UUID, TEXT) TO service_role')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.create_manager_otp_challenge(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role')
        expect(migration).not.toMatch(/jsonb_build_object\([^)]*p_code/s)
    })

    it('stores only a hash of the OTP and expires the challenge after five minutes', async () => {
        const { createManagerOtpChallenge } = await loadChallengeContract()
        const store = createStore()
        const now = new Date('2026-05-31T00:00:00.000Z')

        const { challenge, plainCode } = await createManagerOtpChallenge({
            userId: 'manager-1',
            sessionId: 'session-1',
            now,
            store,
        })

        expect(challenge.codeHash).toEqual(expect.any(String))
        expect(challenge.codeHash).not.toBe(plainCode)
        expect(JSON.stringify(challenge)).not.toContain(plainCode)
        expect(challenge.expiresAt.toISOString()).toBe('2026-05-31T00:05:00.000Z')
    })

    it('accepts a valid OTP once and rejects the same code after successful verification', async () => {
        const { createManagerOtpChallenge, verifyManagerOtpChallenge } = await loadChallengeContract()
        const store = createStore()
        const now = new Date('2026-05-31T00:00:00.000Z')
        const { challenge, plainCode } = await createManagerOtpChallenge({
            userId: 'manager-1',
            sessionId: 'session-1',
            now,
            store,
        })

        await expect(
            verifyManagerOtpChallenge({ challengeId: challenge.id, code: plainCode, now, store })
        ).resolves.toEqual({ ok: true, stepUpSessionId: 'session-1' })
        await expect(
            verifyManagerOtpChallenge({ challengeId: challenge.id, code: plainCode, now, store })
        ).resolves.toEqual({ ok: false, reason: 'used' })
    })

    it('enforces resend cooldown, attempt limit, and lockout without auditing plaintext OTP values', async () => {
        const { createManagerOtpChallenge, resendManagerOtpChallenge, verifyManagerOtpChallenge } =
            await loadChallengeContract()
        const store = createStore()
        const now = new Date('2026-05-31T00:00:00.000Z')
        const { challenge, plainCode } = await createManagerOtpChallenge({
            userId: 'manager-1',
            sessionId: 'session-1',
            now,
            store,
        })

        await expect(resendManagerOtpChallenge({ challengeId: challenge.id, now, store })).resolves.toEqual({
            ok: false,
            reason: 'cooldown',
        })

        await verifyManagerOtpChallenge({ challengeId: challenge.id, code: '000000', now, store })
        await verifyManagerOtpChallenge({ challengeId: challenge.id, code: '111111', now, store })
        await verifyManagerOtpChallenge({ challengeId: challenge.id, code: '222222', now, store })

        await expect(
            verifyManagerOtpChallenge({ challengeId: challenge.id, code: plainCode, now, store })
        ).resolves.toEqual({ ok: false, reason: 'locked' })
        expect(JSON.stringify(store.auditPayloads)).not.toContain(plainCode)
    })

    it('keeps concurrent manager challenges isolated by challenge id', async () => {
        const { createManagerOtpChallenge, verifyManagerOtpChallenge } = await loadChallengeContract()
        const store = createStore()
        const now = new Date('2026-05-31T00:00:00.000Z')
        const first = await createManagerOtpChallenge({
            userId: 'manager-1',
            sessionId: 'session-1',
            now,
            store,
        })
        await createManagerOtpChallenge({
            userId: 'manager-2',
            sessionId: 'session-2',
            now,
            store,
        })

        await expect(
            verifyManagerOtpChallenge({
                challengeId: first.challenge.id,
                code: first.plainCode,
                now,
                store,
            }),
        ).resolves.toEqual({ ok: true, stepUpSessionId: 'session-1' })
    })

    it('resends by replacing the stored OTP hash and returning the new plaintext code once cooldown passes', async () => {
        const { createManagerOtpChallenge, resendManagerOtpChallenge, verifyManagerOtpChallenge } =
            await loadChallengeContract()
        const store = createStore()
        const now = new Date('2026-05-31T00:00:00.000Z')
        const { challenge, plainCode } = await createManagerOtpChallenge({
            userId: 'manager-1',
            sessionId: 'session-1',
            now,
            store,
        })
        const originalHash = challenge.codeHash

        const resendAt = new Date('2026-05-31T00:01:01.000Z')
        const resendResult = await resendManagerOtpChallenge({
            challengeId: challenge.id,
            now: resendAt,
            store,
        })

        expect(resendResult).toEqual({ ok: true, plainCode: expect.stringMatching(/^\d{6}$/) })
        if (!resendResult.ok) throw new Error('expected resend success')
        expect(challenge.codeHash).not.toBe(originalHash)
        expect(challenge.expiresAt.toISOString()).toBe('2026-05-31T00:06:01.000Z')
        expect(JSON.stringify(challenge)).not.toContain(resendResult.plainCode)
        await expect(
            verifyManagerOtpChallenge({ challengeId: challenge.id, code: plainCode, now: resendAt, store }),
        ).resolves.toEqual({ ok: false, reason: 'invalid_code' })
        await expect(
            verifyManagerOtpChallenge({ challengeId: challenge.id, code: resendResult.plainCode, now: resendAt, store }),
        ).resolves.toEqual({ ok: true, stepUpSessionId: 'session-1' })
    })

    it('does not resend an already-used challenge', async () => {
        const { createManagerOtpChallenge, resendManagerOtpChallenge, verifyManagerOtpChallenge } =
            await loadChallengeContract()
        const store = createStore()
        const now = new Date('2026-05-31T00:00:00.000Z')
        const { challenge, plainCode } = await createManagerOtpChallenge({
            userId: 'manager-1',
            sessionId: 'session-1',
            now,
            store,
        })

        await verifyManagerOtpChallenge({ challengeId: challenge.id, code: plainCode, now, store })

        await expect(
            resendManagerOtpChallenge({
                challengeId: challenge.id,
                now: new Date('2026-05-31T00:01:01.000Z'),
                store,
            }),
        ).resolves.toEqual({ ok: false, reason: 'used' })
    })
})
