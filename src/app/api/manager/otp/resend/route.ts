import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createManagerOtpEmailDelivery } from '@/lib/manager-email-otp/delivery'
import {
    getManagerOtpRouteContext,
    restoreManagerOtpChallengeRecord,
    resendManagerOtpChallengeRecord,
} from '@/lib/manager-email-otp/server-records'
import { isSameOriginRequest } from '../request-guards'
import { contextErrorResponse } from '../responses'

const ResendOtpSchema = z.object({
    challengeId: z.string().uuid(),
})

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
        const statusCode = result.status === 'cooldown' ? 429 : 400
        return NextResponse.json({ ok: false, status: result.status, maskedEmail: context.maskedEmail }, { status: statusCode })
    }

    const delivery = createManagerOtpEmailDelivery()
    const deliveryResult = await delivery.sendOtp({
        to: context.otpEmail,
        code: result.plainCode,
        expiresInMinutes: 5,
    }).catch(() => ({ ok: false as const }))

    if (!deliveryResult.ok) {
        console.error('Manager OTP resend delivery failed', { status: 'provider_failed' })
        try {
            await restoreManagerOtpChallengeRecord(result.rollback)
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
        challengeId: result.challenge.id,
        maskedEmail: context.maskedEmail,
        expiresAt: result.challenge.expires_at,
        resendAvailableAt: result.challenge.resend_available_at,
    })
}
