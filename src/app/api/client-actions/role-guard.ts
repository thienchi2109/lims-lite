import { createClient } from '@/lib/supabase/server'
import type { ClientActionName } from '@/lib/client-actions/types'
import { MANAGER_OTP_REQUIRED_ERROR, shouldRequireManagerStepUp } from '@/lib/manager-email-otp/guards'
import { decodeJwtPayload } from '@/lib/jwt'

const DOCTOR_ALLOWED_ACTIONS = new Set<ClientActionName>(['getSamples'])
const MANAGER_FORBIDDEN_ACTIONS = new Set<ClientActionName>(['createSample', 'accessionAndAssignTests'])
export const CLIENT_ACTION_FORBIDDEN_ERROR = 'Bạn không có quyền thực hiện thao tác này'

function createCookieReader(request?: Request) {
    const cookieHeader = request?.headers.get('cookie') ?? ''
    const cookies = new Map<string, string>()

    cookieHeader.split(';').forEach((entry) => {
        const [rawName, ...rawValue] = entry.trim().split('=')
        if (!rawName || rawValue.length === 0) return
        try {
            cookies.set(rawName, decodeURIComponent(rawValue.join('=')))
        } catch {
            cookies.set(rawName, rawValue.join('='))
        }
    })

    return {
        get(name: string) {
            const value = cookies.get(name)
            return value === undefined ? undefined : { value }
        },
    }
}

function extractSessionId(accessToken: string | null | undefined) {
    if (!accessToken) return null
    const payload = decodeJwtPayload<{ session_id?: string; sid?: string }>(accessToken)
    return payload?.session_id ?? payload?.sid ?? null
}

function readOtpEmailUpdatedAt(userData: { manager_otp_settings?: unknown } | null | undefined) {
    const otpSettings = userData?.manager_otp_settings as
        | { updated_at?: string | null }
        | Array<{ updated_at?: string | null }>
        | null
        | undefined

    return Array.isArray(otpSettings)
        ? otpSettings[0]?.updated_at ?? null
        : otpSettings?.updated_at ?? null
}

export async function getClientActionDenial(action: ClientActionName, request?: Request) {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return null
    }

    const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role, can_access_confidential, manager_otp_settings(updated_at)')
        .eq('id', user.id)
        .single()

    if (roleError) {
        return {
            error: 'Không thể xác minh quyền truy cập',
            status: 403,
        }
    }

    if (userData?.role === 'doctor') {
        if (DOCTOR_ALLOWED_ACTIONS.has(action)) {
            return null
        }

        return {
            error: CLIENT_ACTION_FORBIDDEN_ERROR,
            status: 403,
        }
    }

    const sessionResult = await supabase.auth.getSession?.()
    const sessionId = extractSessionId(sessionResult?.data?.session?.access_token)

    if (
        await shouldRequireManagerStepUp(
            {
                userId: user.id,
                role: userData.role,
                can_access_confidential: userData.can_access_confidential,
                sessionId,
                otpEmailUpdatedAt: readOtpEmailUpdatedAt(userData) ?? 'unconfigured',
            },
            createCookieReader(request),
        )
    ) {
        return {
            error: MANAGER_OTP_REQUIRED_ERROR,
            status: 403,
        }
    }

    if (userData?.role === 'manager' && MANAGER_FORBIDDEN_ACTIONS.has(action)) {
        return {
            error: CLIENT_ACTION_FORBIDDEN_ERROR,
            status: 403,
        }
    }

    return null
}
