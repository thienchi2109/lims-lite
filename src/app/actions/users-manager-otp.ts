'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/server'
import { isAuthError, requireRole } from '@/lib/auth-helpers'
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

export async function configureManagerOtpEmail(input: { userId: string; otpEmail: string }) {
    const validated = ConfigureManagerOtpEmailSchema.parse(input)
    const currentUser = await requireCurrentManager()

    if (validated.userId === currentUser.id) {
        throw new Error('Quản lý không được tự cấu hình email OTP của chính mình')
    }

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
