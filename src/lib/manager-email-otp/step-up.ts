import { ManagerStepUpPayloadSchema, type ManagerStepUpPayload } from '@/types'

export const MANAGER_STEP_UP_COOKIE_NAME = 'manager_otp_step_up'

type ManagerStepUpCohort = 'standard' | 'confidential' | 'analyst-confidential'

type CreateInput = {
    userId: string
    sessionId: string
    cohort: ManagerStepUpCohort
    otpEmailUpdatedAt: string
    expiresAt: Date
    secret: string
    authorizationId?: string
    verifiedAt?: string
}

type VerifyInput = CreateInput & {
    now: Date
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function encodeBase64Url(value: string) {
    return bytesToBase64Url(textEncoder.encode(value))
}

function decodeBase64Url(value: string) {
    return textDecoder.decode(base64UrlToBytes(value))
}

function bytesToBase64Url(bytes: Uint8Array) {
    let binary = ''
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte)
    })

    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/u, '')
}

function base64UrlToBytes(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const binary = atob(padded)

    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function signPayload(payload: string, secret: string) {
    const key = await globalThis.crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    )
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, textEncoder.encode(payload))

    return bytesToBase64Url(new Uint8Array(signature))
}

function signaturesMatch(left: string, right: string) {
    const maxLength = Math.max(left.length, right.length)
    let diff = left.length ^ right.length

    for (let index = 0; index < maxLength; index += 1) {
        const leftCode = index < left.length ? left.charCodeAt(index) : 0
        const rightCode = index < right.length ? right.charCodeAt(index) : 0
        diff |= leftCode ^ rightCode
    }

    return diff === 0
}

export async function createManagerStepUpCookieValue(input: CreateInput) {
    const payload: ManagerStepUpPayload = {
        userId: input.userId,
        sessionId: input.sessionId,
        cohort: input.cohort,
        otpEmailUpdatedAt: input.otpEmailUpdatedAt,
        expiresAt: input.expiresAt.toISOString(),
        ...(input.authorizationId && input.verifiedAt
            ? {
                  authorizationId: input.authorizationId,
                  verifiedAt: input.verifiedAt,
              }
            : {}),
    }
    const encodedPayload = encodeBase64Url(JSON.stringify(payload))
    const signature = await signPayload(encodedPayload, input.secret)

    return `${encodedPayload}.${signature}`
}

export async function readManagerStepUpCookieValue(
    cookieValue: string | null | undefined,
    input: VerifyInput,
): Promise<
    | { ok: true; payload: ManagerStepUpPayload }
    | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'mismatch' }
> {
    if (!cookieValue) {
        return { ok: false, reason: 'missing' }
    }

    const [encodedPayload, signature, extra] = cookieValue.split('.')
    if (!encodedPayload || !signature || extra !== undefined) {
        return { ok: false, reason: 'invalid' }
    }

    if (!signaturesMatch(signature, await signPayload(encodedPayload, input.secret))) {
        return { ok: false, reason: 'invalid' }
    }

    let payload: ManagerStepUpPayload
    try {
        payload = ManagerStepUpPayloadSchema.parse(JSON.parse(decodeBase64Url(encodedPayload)))
    } catch {
        return { ok: false, reason: 'invalid' }
    }

    const expiresAt = Date.parse(payload.expiresAt)
    if (!Number.isFinite(expiresAt)) {
        return { ok: false, reason: 'invalid' }
    }

    if (expiresAt <= input.now.getTime()) {
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

    return { ok: true, payload }
}

export async function verifyManagerStepUpCookieValue(
    cookieValue: string | null | undefined,
    input: VerifyInput,
): Promise<
    { ok: true } | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'mismatch' }
> {
    const result = await readManagerStepUpCookieValue(cookieValue, input)
    return result.ok ? { ok: true } : result
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
    const secret = process.env.MANAGER_OTP_STEP_UP_SECRET || process.env.JWT_SECRET
    if (secret) {
        return secret
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('MANAGER_OTP_STEP_UP_SECRET or JWT_SECRET is required in production')
    }

    return 'dev-manager-otp-step-up-secret'
}
