'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isAuthError, requireRole } from '@/lib/auth-helpers'
import { decodeJwtPayload } from '@/lib/jwt'
import { MANAGER_OTP_REQUIRED_ERROR, shouldRequireManagerStepUp } from '@/lib/manager-email-otp/guards'
import { ConfigureManagerOtpEmailSchema } from '@/types'

async function requireCurrentManager() {
    const auth = await requireRole('manager')
    if (isAuthError(auth)) {
        throw new Error(auth.error)
    }

    return auth
}

async function requireTargetManager(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
    const { data, error } = await adminClient
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

    if (error || data?.role !== 'manager') {
        throw new Error('Chỉ tài khoản quản lý mới được cấu hình email nhận OTP quản lý')
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

async function requireManagerStepUpForOtpConfiguration(managerId: string) {
    const supabase = await createClient()
    const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('can_access_confidential, manager_otp_settings(updated_at)')
        .eq('id', managerId)
        .single()

    if (userDataError || !userData) {
        throw new Error('Không thể xác minh trạng thái OTP của quản lý hiện tại')
    }

    const sessionResult = await supabase.auth.getSession?.()
    const cookieStore = await cookies()

    if (
        shouldRequireManagerStepUp(
            {
                userId: managerId,
                role: 'manager',
                can_access_confidential: userData?.can_access_confidential === true,
                sessionId: extractSessionId(sessionResult?.data?.session?.access_token),
                otpEmailUpdatedAt: readOtpEmailUpdatedAt(userData) ?? 'unconfigured',
            },
            cookieStore,
        )
    ) {
        throw new Error(MANAGER_OTP_REQUIRED_ERROR)
    }
}

export async function configureManagerOtpEmail(input: { userId: string; otpEmail: string }) {
    const validated = ConfigureManagerOtpEmailSchema.parse(input)
    const currentUser = await requireCurrentManager()

    if (validated.userId === currentUser.id) {
        throw new Error('Quản lý không được tự cấu hình email OTP của chính mình')
    }

    await requireManagerStepUpForOtpConfiguration(currentUser.id)

    const adminClient = createAdminClient()
    await requireTargetManager(adminClient, validated.userId)

    const { error } = await adminClient
        .from('manager_otp_settings')
        .upsert({
            user_id: validated.userId,
            otp_email: validated.otpEmail,
            updated_at: new Date().toISOString(),
        })

    if (error) {
        throw new Error(`Không thể cấu hình email OTP quản lý: ${error.message}`)
    }

    revalidatePath('/manager/users')
    return { success: true }
}

export async function getMaskedManagerOtpEmail(userId: string) {
    const validatedUserId = z.string().uuid('ID người dùng không hợp lệ').parse(userId)
    await requireCurrentManager()

    const adminClient = createAdminClient()
    const { data, error } = await adminClient
        .from('manager_otp_settings')
        .select('otp_email')
        .eq('user_id', validatedUserId)
        .single()

    if (error || !data?.otp_email) {
        return { otpEmail: null }
    }

    const [name, domain] = data.otp_email.split('@')
    const maskedName = name.length <= 2
        ? `${name[0] ?? ''}***`
        : `${name.slice(0, 2)}***`

    return { otpEmail: `${maskedName}@${domain}` }
}
