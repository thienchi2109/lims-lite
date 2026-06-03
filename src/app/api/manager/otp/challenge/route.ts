import { NextResponse } from 'next/server'

import { createManagerOtpEmailDelivery } from '@/lib/manager-email-otp/delivery'
import {
    createManagerOtpChallengeRecord,
    deleteManagerOtpChallengeRecord,
    getManagerOtpRouteContext,
} from '@/lib/manager-email-otp/server-records'
import { isSameOriginRequest } from '../request-guards'
import { contextErrorResponse } from '../responses'

export async function POST(request: Request) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ ok: false, status: 'invalid_origin' }, { status: 403 })
    }

    const context = await getManagerOtpRouteContext()
    if (!context.ok) return contextErrorResponse(context)

    const challengeResult = await createManagerOtpChallengeRecord(context)
    if (!challengeResult.ok) {
        const statusCode = challengeResult.status === 'cooldown' ? 429 : 400
        return NextResponse.json({
            ok: false,
            status: challengeResult.status,
            maskedEmail: context.maskedEmail,
            challengeId: challengeResult.challenge.id,
            expiresAt: challengeResult.challenge.expires_at,
            resendAvailableAt: challengeResult.challenge.resend_available_at,
        }, { status: statusCode })
    }

    const { challenge, plainCode } = challengeResult
    const delivery = createManagerOtpEmailDelivery()
    const deliveryResult = await delivery.sendOtp({
        to: context.otpEmail,
        code: plainCode,
        expiresInMinutes: 5,
    }).catch(() => ({ ok: false as const }))

    if (!deliveryResult.ok) {
        try {
            await deleteManagerOtpChallengeRecord(challenge.id)
        } catch {
            return NextResponse.json(
                { ok: false, status: 'persist_failed', maskedEmail: context.maskedEmail },
                { status: 500 },
            )
        }
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
