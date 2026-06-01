'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { ConfigureManagerOtpEmailSchema } from '@/types'

async function requireCurrentManager() {
    const supabase = await createClient()
    const {
        data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (!currentUser) throw new Error('Unauthorized')

    const { data: roleCheck } = await supabase
        .from('users')
        .select('role')
        .eq('id', currentUser.id)
        .single()

    if (roleCheck?.role !== 'manager') {
        throw new Error('Unauthorized: Only managers can configure manager OTP email')
    }

    return currentUser
}

export async function configureManagerOtpEmail(input: { userId: string; otpEmail: string }) {
    const validated = ConfigureManagerOtpEmailSchema.parse(input)
    const currentUser = await requireCurrentManager()

    if (validated.userId === currentUser.id) {
        throw new Error('Managers cannot self-configure their own OTP email')
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient
        .from('manager_otp_settings')
        .upsert({
            user_id: validated.userId,
            otp_email: validated.otpEmail,
            updated_at: new Date().toISOString(),
        })

    if (error) {
        throw new Error(`Failed to configure manager OTP email: ${error.message}`)
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
