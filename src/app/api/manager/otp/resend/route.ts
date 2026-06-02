import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createManagerOtpEmailDelivery } from '@/lib/manager-email-otp/delivery'
import {
    getManagerOtpRouteContext,
    restoreManagerOtpChallengeRecord,
    resendManagerOtpChallengeRecord,
} from '@/lib/manager-email-otp/server-records'
import { isSameOriginRequest } from '../request-guards'

const ResendOtpSchema = z.object({
    challengeId: z.string().uuid(),
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

    const parsed = ResendOtpSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
        return NextResponse.json({ ok: false, status: 'invalid' }, { status: 400 })
    }

    const context = await getManagerOtpRouteContext()
    if (!context.ok) return contextErrorResponse(context)

    const result = await resendManagerOtpChallengeRecord(context, parsed.data.challengeId)
    if (!result.ok) {
        return NextResponse.json({ ok: false, status: result.status, maskedEmail: context.maskedEmail }, { status: 400 })
    }

    const delivery = createManagerOtpEmailDelivery()
    const deliveryResult = await delivery.sendOtp({
        to: context.otpEmail,
        code: result.plainCode,
        expiresInMinutes: 5,
    }).catch(() => ({ ok: false as const }))

    if (!deliveryResult.ok) {
        await restoreManagerOtpChallengeRecord(result.rollback)
        return NextResponse.json(
            { ok: false, status: 'provider_failed', maskedEmail: context.maskedEmail },
            { status: 503 },
        )
    }

    return NextResponse.json({
        ok: true,
        challengeId: result.challenge.id,
        maskedEmail: context.maskedEmail,
        expiresAt: result.challenge.expires_at,
        resendAvailableAt: result.challenge.resend_available_at,
    })
}
