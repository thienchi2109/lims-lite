// Caller-bound, read-only template download; workbook bytes exist only in request memory.
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decodeJwtPayload } from '@/lib/jwt'
import { shouldRequireManagerStepUp } from '@/lib/manager-email-otp/guards'
import { readTemplateSigningConfig } from '@/lib/accession-template/binding'
import { generateAccessionTemplate } from '@/lib/accession-template/workbook'

export const runtime = 'nodejs'

const CACHE_HEADERS = { 'Cache-Control': 'private, no-store' }

function failure(error: string, status: number) {
    return NextResponse.json({ error }, { status, headers: CACHE_HEADERS })
}

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return failure('Vui lòng đăng nhập để tải template Excel.', 401)
        }

        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('role, deleted_at, can_access_confidential, manager_otp_settings(updated_at)')
            .eq('id', user.id)
            .single()
        if (profileError || profile?.role !== 'analyst' || profile.deleted_at !== null) {
            return failure('Bạn không có quyền tải template Excel.', 403)
        }

        const { data: { session } } = await supabase.auth.getSession()
        const payload = session?.access_token
            ? decodeJwtPayload<{ session_id?: string; sid?: string }>(session.access_token)
            : null
        const settings = profile.manager_otp_settings as { updated_at?: string | null } | { updated_at?: string | null }[] | null
        if (await shouldRequireManagerStepUp({
            userId: user.id,
            role: profile.role,
            can_access_confidential: profile.can_access_confidential,
            sessionId: payload?.session_id ?? payload?.sid,
            otpEmailUpdatedAt: (Array.isArray(settings) ? settings[0]?.updated_at : settings?.updated_at) ?? 'unconfigured',
        }, await cookies())) {
            return failure('Vui lòng xác thực OTP email trước khi tải template Excel.', 403)
        }

        const config = readTemplateSigningConfig()
        const { data: snapshot, error } = await supabase.rpc('get_accession_template_snapshot')
        if (error?.code === '42501') return failure('Bạn không có quyền tải template Excel.', 403)
        if (error) return failure('Chưa thể tải template Excel. Vui lòng thử lại sau.', 503)

        const workbook = generateAccessionTemplate(snapshot, config)
        return new Response(new Uint8Array(workbook), {
            headers: {
                ...CACHE_HEADERS,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="lims-tiep-nhan-mau-v1.xlsx"',
            },
        })
    } catch {
        return failure('Chưa thể tải template Excel. Vui lòng thử lại sau.', 503)
    }
}
