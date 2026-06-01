import { createHmac, timingSafeEqual } from 'crypto'

export const MANAGER_STEP_UP_COOKIE_NAME = 'manager_otp_step_up'

type ManagerStepUpCohort = 'standard' | 'confidential'

type StepUpPayload = {
    userId: string
    sessionId: string
    cohort: ManagerStepUpCohort
    otpEmailUpdatedAt: string
    expiresAt: string
}

type CreateInput = {
    userId: string
    sessionId: string
    cohort: ManagerStepUpCohort
    otpEmailUpdatedAt: string
    expiresAt: Date
    secret: string
}

type VerifyInput = CreateInput & {
    now: Date
}

function encodeBase64Url(value: string) {
    return Buffer.from(value, 'utf8').toString('base64url')
}

function decodeBase64Url(value: string) {
    return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(payload: string, secret: string) {
    return createHmac('sha256', secret).update(payload).digest('base64url')
}

function signaturesMatch(left: string, right: string) {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createManagerStepUpCookieValue(input: CreateInput) {
    const payload: StepUpPayload = {
        userId: input.userId,
        sessionId: input.sessionId,
        cohort: input.cohort,
        otpEmailUpdatedAt: input.otpEmailUpdatedAt,
        expiresAt: input.expiresAt.toISOString(),
    }
    const encodedPayload = encodeBase64Url(JSON.stringify(payload))
    const signature = signPayload(encodedPayload, input.secret)

    return `${encodedPayload}.${signature}`
}

export function verifyManagerStepUpCookieValue(
    cookieValue: string | null | undefined,
    input: VerifyInput,
): { ok: true } | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'mismatch' } {
    if (!cookieValue) {
        return { ok: false, reason: 'missing' }
    }

    const [encodedPayload, signature, extra] = cookieValue.split('.')
    if (!encodedPayload || !signature || extra !== undefined) {
        return { ok: false, reason: 'invalid' }
    }

    if (!signaturesMatch(signature, signPayload(encodedPayload, input.secret))) {
        return { ok: false, reason: 'invalid' }
    }

    let payload: StepUpPayload
    try {
        payload = JSON.parse(decodeBase64Url(encodedPayload)) as StepUpPayload
    } catch {
        return { ok: false, reason: 'invalid' }
    }

    if (Date.parse(payload.expiresAt) <= input.now.getTime()) {
        return { ok: false, reason: 'expired' }
    }

    if (
        payload.userId !== input.userId ||
        payload.sessionId !== input.sessionId ||
        payload.cohort !== input.cohort ||
        payload.otpEmailUpdatedAt !== input.otpEmailUpdatedAt
    ) {
        return { ok: false, reason: 'mismatch' }
    }

    return { ok: true }
}

export function getManagerStepUpCookieOptions(expiresAt?: Date) {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires: expiresAt,
    }
}

export function getManagerStepUpSecret() {
    return process.env.MANAGER_OTP_STEP_UP_SECRET || process.env.JWT_SECRET || 'dev-manager-otp-step-up-secret'
}
