import { NextResponse } from 'next/server'

import type { ManagerOtpRouteContext } from '@/lib/manager-email-otp/server-records'

type ManagerOtpContextError = Exclude<ManagerOtpRouteContext, { ok: true }>

export function contextErrorResponse(context: ManagerOtpContextError) {
    let status = 400
    if (context.status === 'unauthenticated' || context.status === 'session_expired') {
        status = 401
    } else if (context.status === 'forbidden') {
        status = 403
    }

    return NextResponse.json({ ok: false, status: context.status, maskedEmail: context.maskedEmail ?? null }, { status })
}
