'use server'

import { createClient } from '@/lib/supabase/server'
import { ChangePasswordSchema } from '@/types'
import { revalidatePath } from 'next/cache'

type UpdatePasswordState = {
    error?: string
    success?: boolean
}

export async function updatePassword(prevState: UpdatePasswordState | null, formData: FormData) {
    void prevState

    const supabase = await createClient()

    // Validate input with Zod
    const rawData = {
        currentPassword: formData.get('currentPassword'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
    }

    const validation = ChangePasswordSchema.safeParse(rawData)

    if (!validation.success) {
        return {
            error: validation.error.flatten().fieldErrors,
        }
    }

    const { currentPassword, password } = validation.data

    try {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !user.email) {
            return {
                error: { general: ['Phiên đăng nhập không hợp lệ'] }
            }
        }

        // 2. Verify current password by signing in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword
        })

        if (signInError) {
            return {
                error: { currentPassword: ['Mật khẩu hiện tại không đúng'] }
            }
        }

        // 3. Update to new password
        const { error: updateError } = await supabase.auth.updateUser({
            password: password
        })

        if (updateError) {
            console.error('Password update error:', updateError)
            return {
                error: { general: [updateError.message] }
            }
        }

        revalidatePath('/profile')
        return {
            success: true,
            message: 'Đổi mật khẩu thành công!'
        }
    } catch (error) {
        console.error('Unexpected error during password update:', error)
        return {
            error: { general: ['Đã có lỗi xảy ra. Vui lòng thử lại sau.'] }
        }
    }
}
