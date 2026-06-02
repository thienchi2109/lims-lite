import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
    MANAGER_STEP_UP_COOKIE_NAME,
    getManagerStepUpCookieOptions,
} from '@/lib/manager-email-otp/step-up'

export async function POST() {
    try {
        const supabase = await createClient()
        await supabase.auth.signOut()
        const response = NextResponse.json({ success: true })
        response.cookies.set(MANAGER_STEP_UP_COOKIE_NAME, '', {
            ...getManagerStepUpCookieOptions(),
            maxAge: 0,
        })
        return response
    } catch (error) {
        console.error('Logout failed', error)
        return NextResponse.json(
            { error: 'Không thể đăng xuất. Vui lòng thử lại.' },
            { status: 500 }
        )
    }
}
