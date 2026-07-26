import { decodeJwtPayload } from '@/lib/jwt'
import { getManagerOtpCohort } from '@/lib/manager-email-otp/guards'
import {
    getManagerStepUpSecret,
    MANAGER_STEP_UP_COOKIE_NAME,
    readManagerStepUpCookieValue,
} from '@/lib/manager-email-otp/step-up'
import { createClient } from '@/lib/supabase/server'
import type { ApprovalError } from '@/types'

type ApprovalBatchUserClient = Awaited<ReturnType<typeof createClient>>

const APPROVAL_BATCH_STEP_UP_COHORT = 'manager_email_otp' as const

type ApprovalBatchStepUp = {
    authorizationId: string
    verifiedAt: string
    cohort: typeof APPROVAL_BATCH_STEP_UP_COHORT
}

export type ApprovalBatchManager = {
    id: string
    canAccessConfidential: boolean
    client: ApprovalBatchUserClient
    stepUp?: ApprovalBatchStepUp
}

export type ApprovalBatchAuthResult =
    | {
          ok: true
          manager: ApprovalBatchManager
      }
    | {
          ok: false
          status: number
          error: ApprovalError
      }

function readCookie(request: Request, name: string) {
    const cookieHeader = request.headers.get('cookie') ?? ''

    for (const entry of cookieHeader.split(';')) {
        const [rawName, ...rawValue] = entry.trim().split('=')
        if (rawName !== name || rawValue.length === 0) continue

        try {
            return decodeURIComponent(rawValue.join('='))
        } catch {
            return rawValue.join('=')
        }
    }

    return null
}

function extractSessionId(accessToken: string | null | undefined) {
    if (!accessToken) return null
    const payload = decodeJwtPayload<{ session_id?: string; sid?: string }>(
        accessToken,
    )
    return payload?.session_id ?? payload?.sid ?? null
}

function readOtpEmailUpdatedAt(userData: {
    manager_otp_settings?: unknown
} | null | undefined) {
    const settings = userData?.manager_otp_settings as
        | { updated_at?: string | null }
        | Array<{ updated_at?: string | null }>
        | null
        | undefined

    return Array.isArray(settings)
        ? settings[0]?.updated_at ?? null
        : settings?.updated_at ?? null
}

export async function getApprovalBatchManager(
    request: Request,
    options: { requireStepUp: boolean },
): Promise<ApprovalBatchAuthResult> {
    const client = await createClient()
    const {
        data: { user },
        error: authError,
    } = await client.auth.getUser()

    if (authError || !user) {
        return {
            ok: false,
            status: 401,
            error: { code: 'NOT_AUTHENTICATED' },
        }
    }

    const { data: userData, error: roleError } = await client
        .from('users')
        .select(
            'role, can_access_confidential, manager_otp_settings(updated_at)',
        )
        .eq('id', user.id)
        .single()

    if (roleError || userData?.role !== 'manager') {
        return {
            ok: false,
            status: 403,
            error: { code: 'MANAGER_REQUIRED' },
        }
    }

    const manager: ApprovalBatchManager = {
        id: user.id,
        canAccessConfidential: userData.can_access_confidential === true,
        client,
    }
    if (!options.requireStepUp) {
        return { ok: true, manager }
    }

    const sessionResult = await client.auth.getSession?.()
    const sessionId = extractSessionId(
        sessionResult?.data?.session?.access_token,
    )
    const otpEmailUpdatedAt = readOtpEmailUpdatedAt(userData)
    const cohort = getManagerOtpCohort({
        role: 'manager',
        can_access_confidential: manager.canAccessConfidential,
    })

    if (
        !sessionId
        || !otpEmailUpdatedAt
        || (cohort !== 'standard' && cohort !== 'confidential')
    ) {
        return {
            ok: false,
            status: 403,
            error: { code: 'OTP_STEP_UP_REQUIRED' },
        }
    }

    const stepUp = await readManagerStepUpCookieValue(
        readCookie(request, MANAGER_STEP_UP_COOKIE_NAME),
        {
            userId: manager.id,
            sessionId,
            cohort,
            otpEmailUpdatedAt,
            expiresAt: new Date(Date.now() + 1),
            now: new Date(),
            secret: getManagerStepUpSecret(),
        },
    )

    if (
        !stepUp.ok
        || !stepUp.payload.authorizationId
        || !stepUp.payload.verifiedAt
    ) {
        return {
            ok: false,
            status: 403,
            error: { code: 'OTP_STEP_UP_REQUIRED' },
        }
    }

    return {
        ok: true,
        manager: {
            ...manager,
            stepUp: {
                authorizationId: stepUp.payload.authorizationId,
                verifiedAt: stepUp.payload.verifiedAt,
                cohort: APPROVAL_BATCH_STEP_UP_COHORT,
            },
        },
    }
}
