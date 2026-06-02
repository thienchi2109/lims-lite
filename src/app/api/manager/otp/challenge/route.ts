import { NextResponse } from 'next/server'

import { createManagerOtpEmailDelivery } from '@/lib/manager-email-otp/delivery'
import {
    createManagerOtpChallengeRecord,
    deleteManagerOtpChallengeRecord,
    getManagerOtpRouteContext,
} from '@/lib/manager-email-otp/server-records'
import { isSameOriginRequest } from '../request-guards'

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

    const context = await getManagerOtpRouteContext()
    if (!context.ok) return contextErrorResponse(context)

    const challengeResult = await createManagerOtpChallengeRecord(context)
    if (!challengeResult.ok) {
        return NextResponse.json({
            ok: false,
            status: challengeResult.status,
            maskedEmail: context.maskedEmail,
            challengeId: challengeResult.challenge.id,
            expiresAt: challengeResult.challenge.expires_at,
            resendAvailableAt: challengeResult.challenge.resend_available_at,
        }, { status: 429 })
    }

    const { challenge, plainCode } = challengeResult
    const delivery = createManagerOtpEmailDelivery()
    const deliveryResult = await delivery.sendOtp({
        to: context.otpEmail,
        code: plainCode,
        expiresInMinutes: 5,
    }).catch(() => ({ ok: false as const }))

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
