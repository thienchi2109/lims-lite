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
