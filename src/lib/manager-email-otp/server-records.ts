import { createHash, randomInt, randomUUID } from 'crypto'

import { decodeJwtPayload } from '@/lib/jwt'
import { getManagerOtpCohort } from '@/lib/manager-email-otp/guards'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const CHALLENGE_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

export type ManagerOtpRouteContext =
    | {
          ok: true
          userId: string
          sessionId: string
          canAccessConfidential: boolean
          otpEmail: string
          otpEmailUpdatedAt: string
          maskedEmail: string
      }
    | {
          ok: false
          status: 'unauthenticated' | 'forbidden' | 'unconfigured' | 'session_expired'
          maskedEmail?: string | null
      }

type ChallengeRecord = {
    id: string
    code_hash: string
    expires_at: string
    used_at: string | null
    locked_at: string | null
    attempt_count: number
    resend_available_at: string
}

type PublicChallengeRecord = Pick<ChallengeRecord, 'id' | 'expires_at' | 'resend_available_at'>

type ChallengeRpcResult = {
    ok?: boolean
    status?: 'cooldown' | 'locked'
    challenge?: PublicChallengeRecord
}

function hashOtpCode(code: string) {
    return createHash('sha256').update(code).digest('hex')
}

function generateOtpCode() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function addMs(date: Date, ms: number) {
    return new Date(date.getTime() + ms)
}

function extractSessionId(accessToken: string | null | undefined) {
    if (!accessToken) return null
    const payload = decodeJwtPayload<{ session_id?: string; sid?: string }>(accessToken)
    return payload?.session_id ?? payload?.sid ?? null
}

export function maskManagerOtpEmail(email: string) {
    const [name, domain] = email.split('@')
    const maskedName = name.length <= 2 ? `${name[0] ?? ''}***` : `${name.slice(0, 2)}***`
    return `${maskedName}@${domain}`
}

function readOtpSettings(userData: { manager_otp_settings?: unknown } | null | undefined) {
    const settings = userData?.manager_otp_settings as
        | { otp_email?: string | null; updated_at?: string | null }
        | Array<{ otp_email?: string | null; updated_at?: string | null }>
        | null
        | undefined

    return Array.isArray(settings) ? settings[0] : settings
}

export async function getManagerOtpRouteContext(): Promise<ManagerOtpRouteContext> {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { ok: false, status: 'unauthenticated' }
    }

    const { data: userData } = await supabase
        .from('users')
        .select('role, can_access_confidential, manager_otp_settings(otp_email, updated_at)')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'manager') {
        return { ok: false, status: 'forbidden' }
    }

    const sessionResult = await supabase.auth.getSession?.()
    const sessionId = extractSessionId(sessionResult?.data?.session?.access_token)
    if (!sessionId) {
        return { ok: false, status: 'session_expired' }
    }

    const otpSettings = readOtpSettings(userData)
    if (!otpSettings?.otp_email || !otpSettings.updated_at) {
        return { ok: false, status: 'unconfigured', maskedEmail: null }
    }

    return {
        ok: true,
        userId: user.id,
        sessionId,
        canAccessConfidential: userData.can_access_confidential === true,
        otpEmail: otpSettings.otp_email,
        otpEmailUpdatedAt: otpSettings.updated_at,
        maskedEmail: maskManagerOtpEmail(otpSettings.otp_email),
    }
}

export function getManagerOtpStepUpCohort(context: Extract<ManagerOtpRouteContext, { ok: true }>) {
    return getManagerOtpCohort({
        role: 'manager',
        can_access_confidential: context.canAccessConfidential,
    })
}

export async function createManagerOtpChallengeRecord(context: Extract<ManagerOtpRouteContext, { ok: true }>) {
    const now = new Date()
    const plainCode = generateOtpCode()
    const { data, error } = await createAdminClient().rpc('create_manager_otp_challenge', {
        p_challenge_id: randomUUID(),
        p_user_id: context.userId,
        p_session_id: context.sessionId,
        p_code_hash: hashOtpCode(plainCode),
        p_expires_at: addMs(now, CHALLENGE_TTL_MS).toISOString(),
        p_resend_available_at: addMs(now, RESEND_COOLDOWN_MS).toISOString(),
    })
    const result = data as ChallengeRpcResult | null

    if (error || !result?.challenge) {
        throw new Error(error?.message ?? 'Unable to create manager OTP challenge')
    }

    if (result.ok === true) {
        return { ok: true as const, plainCode, challenge: result.challenge }
    }

    if (result.status === 'cooldown' || result.status === 'locked') {
        return { ok: false as const, status: result.status, challenge: result.challenge }
    }

    throw new Error('Unable to create manager OTP challenge')
}

export async function deleteManagerOtpChallengeRecord(challengeId: string) {
    const { error } = await createAdminClient().from('manager_otp_challenges').delete().eq('id', challengeId)
    if (error) throw new Error(error.message)
}

async function readChallenge(context: Extract<ManagerOtpRouteContext, { ok: true }>, challengeId: string) {
    const { data, error } = await createAdminClient()
        .from('manager_otp_challenges')
        .select('id, code_hash, expires_at, used_at, locked_at, attempt_count, resend_available_at')
        .eq('id', challengeId)
        .eq('user_id', context.userId)
        .eq('session_id', context.sessionId)
        .single()

    if (error || !data) return null
    return data as ChallengeRecord
}

export async function verifyManagerOtpChallengeRecord(context: Extract<ManagerOtpRouteContext, { ok: true }>, input: {
    challengeId: string
    code: string
}) {
    const challenge = await readChallenge(context, input.challengeId)
    if (!challenge) return { ok: false as const, status: 'not_found' }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient.rpc('verify_manager_otp_challenge', {
        p_challenge_id: challenge.id,
        p_code: input.code,
        p_session_id: context.sessionId,
        p_user_id: context.userId,
    })
    const result = data as { ok?: boolean; status?: string } | null

    if (error || !result) {
        return { ok: false as const, status: 'persist_failed' }
    }

    if (result.ok === true) {
        return { ok: true as const }
    }

    if (
        result.status === 'not_found' ||
        result.status === 'used' ||
        result.status === 'locked' ||
        result.status === 'expired' ||
        result.status === 'invalid'
    ) {
        return { ok: false as const, status: result.status }
    }

    return { ok: false as const, status: 'persist_failed' }
}

export async function resendManagerOtpChallengeRecord(context: Extract<ManagerOtpRouteContext, { ok: true }>, challengeId: string) {
    const challenge = await readChallenge(context, challengeId)
    if (!challenge) return { ok: false as const, status: 'not_found' }
    if (challenge.used_at) return { ok: false as const, status: 'used' }
    if (challenge.locked_at) return { ok: false as const, status: 'locked' }
    if (Date.parse(challenge.expires_at) <= Date.now()) return { ok: false as const, status: 'expired' }
    if (Date.parse(challenge.resend_available_at) > Date.now()) return { ok: false as const, status: 'cooldown' }

    const now = new Date()
    const rollback = {
        id: challenge.id,
        code_hash: challenge.code_hash,
        expires_at: challenge.expires_at,
        attempt_count: challenge.attempt_count,
        resend_available_at: challenge.resend_available_at,
    }
    const plainCode = generateOtpCode()
    const { data, error } = await createAdminClient()
        .from('manager_otp_challenges')
        .update({
            code_hash: hashOtpCode(plainCode),
            attempt_count: 0,
            expires_at: addMs(now, CHALLENGE_TTL_MS).toISOString(),
            resend_available_at: addMs(now, RESEND_COOLDOWN_MS).toISOString(),
        })
        .eq('id', challenge.id)
        .select('id, expires_at, resend_available_at')
        .single()

    if (error || !data) {
        throw new Error(error?.message ?? 'Unable to resend manager OTP challenge')
    }

    return {
        ok: true as const,
        plainCode,
        challenge: data as Pick<ChallengeRecord, 'id' | 'expires_at' | 'resend_available_at'>,
        rollback,
    }
}

export async function restoreManagerOtpChallengeRecord(rollback: Pick<
    ChallengeRecord,
    'id' | 'code_hash' | 'expires_at' | 'attempt_count' | 'resend_available_at'
>) {
    const { error } = await createAdminClient()
        .from('manager_otp_challenges')
        .update({
            code_hash: rollback.code_hash,
            expires_at: rollback.expires_at,
            attempt_count: rollback.attempt_count,
            resend_available_at: rollback.resend_available_at,
        })
        .eq('id', rollback.id)
    if (error) throw new Error(error.message)
}
