import { createHash, randomInt, randomUUID, timingSafeEqual } from 'crypto'

export type ManagerOtpChallenge = {
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

export type CreateChallengeResult = {
    challenge: ManagerOtpChallenge
    plainCode: string
}

export type VerifyChallengeResult =
    | { ok: true; stepUpSessionId: string }
    | { ok: false; reason: 'invalid_code' | 'expired' | 'used' | 'locked' }

export type ChallengeStore = {
    savedChallenge: ManagerOtpChallenge | null
    savedChallenges?: Map<string, ManagerOtpChallenge>
    auditPayloads: unknown[]
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_ATTEMPTS = 3

function addMs(date: Date, ms: number) {
    return new Date(date.getTime() + ms)
}

function generateOtpCode() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function hashOtpCode(code: string) {
    return createHash('sha256').update(code).digest('hex')
}

function codesMatch(inputCode: string, codeHash: string) {
    const inputHash = hashOtpCode(inputCode)
    const inputBuffer = Buffer.from(inputHash, 'hex')
    const storedBuffer = Buffer.from(codeHash, 'hex')

    return inputBuffer.length === storedBuffer.length && timingSafeEqual(inputBuffer, storedBuffer)
}

function audit(store: ChallengeStore, payload: unknown) {
    store.auditPayloads.push(payload)
}

function findChallenge(store: ChallengeStore, challengeId: string) {
    const mappedChallenge = store.savedChallenges?.get(challengeId)
    if (mappedChallenge) {
        return mappedChallenge
    }

    const challenge = store.savedChallenge
    return challenge?.id === challengeId ? challenge : null
}

export async function createManagerOtpChallenge(input: {
    userId: string
    sessionId: string
    now: Date
    store: ChallengeStore
}): Promise<CreateChallengeResult> {
    const plainCode = generateOtpCode()
    const challenge: ManagerOtpChallenge = {
        id: randomUUID(),
        userId: input.userId,
        sessionId: input.sessionId,
        codeHash: hashOtpCode(plainCode),
        expiresAt: addMs(input.now, CHALLENGE_TTL_MS),
        usedAt: null,
        lockedAt: null,
        attemptCount: 0,
        resendAvailableAt: addMs(input.now, RESEND_COOLDOWN_MS),
    }

    input.store.savedChallenge = challenge
    input.store.savedChallenges?.set(challenge.id, challenge)
    audit(input.store, {
        event: 'manager_otp_challenge_created',
        challengeId: challenge.id,
        userId: input.userId,
        sessionId: input.sessionId,
    })

    return { challenge, plainCode }
}

export async function verifyManagerOtpChallenge(input: {
    challengeId: string
    code: string
    now: Date
    store: ChallengeStore
}): Promise<VerifyChallengeResult> {
    const challenge = findChallenge(input.store, input.challengeId)

    if (!challenge || challenge.lockedAt) {
        return { ok: false, reason: 'locked' }
    }

    if (challenge.usedAt) {
        return { ok: false, reason: 'used' }
    }

    if (challenge.expiresAt <= input.now) {
        audit(input.store, { event: 'manager_otp_challenge_expired', challengeId: challenge.id })
        return { ok: false, reason: 'expired' }
    }

    if (codesMatch(input.code, challenge.codeHash)) {
        challenge.usedAt = input.now
        audit(input.store, { event: 'manager_otp_verify_succeeded', challengeId: challenge.id })
        return { ok: true, stepUpSessionId: challenge.sessionId }
    }

    challenge.attemptCount += 1

    if (challenge.attemptCount >= MAX_ATTEMPTS) {
        challenge.lockedAt = input.now
        audit(input.store, { event: 'manager_otp_challenge_locked', challengeId: challenge.id })
        return { ok: false, reason: 'locked' }
    }

    audit(input.store, { event: 'manager_otp_verify_failed', challengeId: challenge.id })
    return { ok: false, reason: 'invalid_code' }
}

export async function resendManagerOtpChallenge(input: {
    challengeId: string
    now: Date
    store: ChallengeStore
}): Promise<{ ok: true; plainCode: string } | { ok: false; reason: 'cooldown' | 'locked' | 'expired' | 'used' }> {
    const challenge = findChallenge(input.store, input.challengeId)

    if (!challenge || challenge.lockedAt) {
        return { ok: false, reason: 'locked' }
    }

    if (challenge.expiresAt <= input.now) {
        return { ok: false, reason: 'expired' }
    }

    if (challenge.usedAt) {
        return { ok: false, reason: 'used' }
    }

    if (challenge.resendAvailableAt > input.now) {
        return { ok: false, reason: 'cooldown' }
    }

    const plainCode = generateOtpCode()
    challenge.codeHash = hashOtpCode(plainCode)
    challenge.attemptCount = 0
    challenge.resendAvailableAt = addMs(input.now, RESEND_COOLDOWN_MS)
    audit(input.store, { event: 'manager_otp_challenge_resent', challengeId: challenge.id })

    return { ok: true, plainCode }
}
