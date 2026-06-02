import { NextResponse } from 'next/server'

import { createManagerOtpEmailDelivery } from '@/lib/manager-email-otp/delivery'
import {
    createManagerOtpChallengeRecord,
    deleteManagerOtpChallengeRecord,
    getManagerOtpRouteContext,
} from '@/lib/manager-email-otp/server-records'

function contextErrorResponse(context: Exclude<Awaited<ReturnType<typeof getManagerOtpRouteContext>>, { ok: true }>) {
    const status = context.status === 'unauthenticated' || context.status === 'session_expired'
        ? 401
        : context.status === 'forbidden'
            ? 403
            : 400

    return NextResponse.json({ ok: false, status: context.status, maskedEmail: context.maskedEmail ?? null }, { status })
}

export async function POST() {
    const context = await getManagerOtpRouteContext()
    if (!context.ok) return contextErrorResponse(context)

    const { challenge, plainCode } = await createManagerOtpChallengeRecord(context)
    const delivery = createManagerOtpEmailDelivery()
    const deliveryResult = await delivery.sendOtp({
        to: context.otpEmail,
        code: plainCode,
        expiresInMinutes: 5,
    })

    if (!deliveryResult.ok) {
        await deleteManagerOtpChallengeRecord(challenge.id)
        return NextResponse.json(
            { ok: false, status: 'provider_failed', maskedEmail: context.maskedEmail },
            { status: 503 },
        )
    }

    return NextResponse.json({
        ok: true,
        challengeId: challenge.id,
        maskedEmail: context.maskedEmail,
        expiresAt: challenge.expires_at,
        resendAvailableAt: challenge.resend_available_at,
    })
}
