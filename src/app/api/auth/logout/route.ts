import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
    try {
        const supabase = await createClient()
        await supabase.auth.signOut()
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Logout failed', error)
        return NextResponse.json(
            { error: 'Không thể đăng xuất. Vui lòng thử lại.' },
            { status: 500 }
        )
    }
}
