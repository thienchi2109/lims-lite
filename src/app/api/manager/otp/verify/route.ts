import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSessionTimeboxSeconds } from '@/lib/auth-session-timebox'
import {
    createManagerStepUpCookieValue,
    getManagerStepUpCookieOptions,
    getManagerStepUpSecret,
    MANAGER_STEP_UP_COOKIE_NAME,
} from '@/lib/manager-email-otp/step-up'
import {
    getManagerOtpRouteContext,
    getManagerOtpStepUpCohort,
    verifyManagerOtpChallengeRecord,
} from '@/lib/manager-email-otp/server-records'
import { isSameOriginRequest } from '../request-guards'

const VerifyOtpSchema = z.object({
    challengeId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
})

function contextErrorResponse(context: Exclude<Awaited<ReturnType<typeof getManagerOtpRouteContext>>, { ok: true }>) {
    const status = context.status === 'unauthenticated' || context.status === 'session_expired'
        ? 401
        : context.status === 'forbidden'
            ? 403
            : 400

    return NextResponse.json({ ok: false, status: context.status, maskedEmail: context.maskedEmail ?? null }, { status })
}

export async function POST(request: Request) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ ok: false, status: 'invalid_origin' }, { status: 403 })
    }

    const parsed = VerifyOtpSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
        return NextResponse.json({ ok: false, status: 'invalid' }, { status: 400 })
    }

    const context = await getManagerOtpRouteContext()
    if (!context.ok) return contextErrorResponse(context)

    const result = await verifyManagerOtpChallengeRecord(context, parsed.data)
    if (!result.ok) {
        return NextResponse.json(
            { ok: false, status: result.status },
            { status: result.status === 'persist_failed' ? 500 : 400 },
        )
    }

    const cohort = getManagerOtpStepUpCohort(context)
    if (!cohort) {
        return NextResponse.json({ ok: false, status: 'forbidden' }, { status: 403 })
    }

    const expiresAt = new Date(Date.now() + getSessionTimeboxSeconds() * 1000)
    const cookieValue = createManagerStepUpCookieValue({
        userId: context.userId,
        sessionId: context.sessionId,
        cohort,
        otpEmailUpdatedAt: context.otpEmailUpdatedAt,
        expiresAt,
        secret: getManagerStepUpSecret(),
    })
    const response = NextResponse.json({ ok: true })
    response.cookies.set(MANAGER_STEP_UP_COOKIE_NAME, cookieValue, getManagerStepUpCookieOptions(expiresAt))
    return response
}
