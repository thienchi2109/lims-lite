type ResendSendResult = {
    data?: { id?: string } | null
    error?: unknown
}

type ResendClientLike = {
    emails: {
        send(input: {
            from: string
            to: string[]
            subject: string
            html: string
            text: string
            replyTo?: string
        }): Promise<ResendSendResult>
    }
}

export type ManagerOtpEmailDelivery = {
    sendOtp(input: {
        to: string
        code: string
        expiresInMinutes: number
    }): Promise<
        | { ok: true; providerMessageId: string | null }
        | { ok: false; reason: 'provider_failed'; error: unknown }
    >
}

type DeliveryConfig = {
    provider?: string
    apiKey?: string
    from?: string
    replyTo?: string
    nodeEnv?: string
    resendClient?: ResendClientLike
}

export function renderManagerOtpEmail(input: { code: string; expiresInMinutes: number }) {
    const subject = 'Mã xác thực email quản lý CDC-LIMS'
    const text = [
        `Mã xác thực của bạn là: ${input.code}`,
        `Mã này hết hạn sau ${input.expiresInMinutes} phút.`,
        'Nếu bạn không yêu cầu mã này, vui lòng liên hệ quản trị viên.',
    ].join('\n')
    const html = [
        '<p>Mã xác thực của bạn là:</p>',
        `<p><strong>${input.code}</strong></p>`,
        `<p>Mã này hết hạn sau ${input.expiresInMinutes} phút.</p>`,
        '<p>Nếu bạn không yêu cầu mã này, vui lòng liên hệ quản trị viên.</p>',
    ].join('')

    return { subject, text, html }
}

export function createManagerOtpEmailDelivery(config: DeliveryConfig = {}): ManagerOtpEmailDelivery {
    const provider = config.provider ?? process.env.MANAGER_OTP_EMAIL_PROVIDER ?? 'noop'
    const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV

    if (provider === 'noop') {
        if (nodeEnv === 'production') {
            throw new Error('Không được dùng noop email adapter trong production')
        }

        return {
            async sendOtp() {
                return { ok: true, providerMessageId: null }
            },
        }
    }

    if (provider !== 'resend') {
        throw new Error(`Unsupported manager OTP email provider: ${provider}`)
    }

    const apiKey = config.apiKey ?? process.env.RESEND_API_KEY
    const from = config.from ?? process.env.MANAGER_OTP_EMAIL_FROM

    if (!apiKey) {
        throw new Error('RESEND_API_KEY is required for manager OTP email delivery')
    }

    if (!from) {
        throw new Error('MANAGER_OTP_EMAIL_FROM is required for manager OTP email delivery')
    }

    const resendClient = config.resendClient ?? createResendClient(apiKey)

    return {
        async sendOtp(input) {
            const message = renderManagerOtpEmail(input)
            const result = await resendClient.emails.send({
                from,
                to: [input.to],
                subject: message.subject,
                html: message.html,
                text: message.text,
                replyTo: config.replyTo ?? process.env.MANAGER_OTP_EMAIL_REPLY_TO,
            })

            if (result.error) {
                return { ok: false, reason: 'provider_failed', error: result.error }
            }

            return { ok: true, providerMessageId: result.data?.id ?? null }
        },
    }
}

function createResendClient(apiKey: string): ResendClientLike {
    return {
        emails: {
            async send(input) {
                const { replyTo, ...rest } = input
                const response = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...rest,
                        ...(replyTo ? { reply_to: replyTo } : {}),
                    }),
                })

                const payload = await response.json().catch(() => null)

                if (!response.ok) {
                    return { data: null, error: payload ?? { status: response.status } }
                }

                return { data: payload, error: null }
            },
        },
    }
}
