'use client'

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2, RotateCw, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type ChallengeState = {
    challengeId: string | null
    maskedEmail: string | null
    expiresAt: string | null
    resendAvailableAt: string | null
}

type ApiResult = {
    ok?: boolean
    challengeId?: string
    maskedEmail?: string | null
    expiresAt?: string | null
    resendAvailableAt?: string | null
    status?: string
}

function mapStatusToMessage(status: string | undefined) {
    if (status === 'expired') return 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.'
    if (status === 'locked') return 'Tài khoản tạm khóa xác thực OTP. Vui lòng liên hệ quản trị viên.'
    if (status === 'invalid') return 'Mã OTP không đúng. Vui lòng kiểm tra và thử lại.'
    if (status === 'cooldown') return 'Chưa thể gửi lại mã. Vui lòng đợi thêm trong giây lát.'
    if (status === 'unconfigured') return 'Chưa có email nhận OTP. Vui lòng liên hệ quản trị viên.'
    return 'Không thể gửi mã OTP. Vui lòng thử lại hoặc liên hệ quản trị viên.'
}

type ManagerOtpVerificationFormProps = {
    initialMaskedEmail: string | null
    successRedirectPath?: '/manager' | '/analyst'
}

export function ManagerOtpVerificationForm({
    initialMaskedEmail,
    successRedirectPath = '/manager',
}: ManagerOtpVerificationFormProps) {
    const [challenge, setChallenge] = useState<ChallengeState>({
        challengeId: null,
        maskedEmail: initialMaskedEmail,
        expiresAt: null,
        resendAvailableAt: null,
    })
    const [code, setCode] = useState('')
    const [message, setMessage] = useState<string | null>(null)
    const [isSending, setIsSending] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const digitInputRefs = useRef<Array<HTMLInputElement | null>>([])
    const isChallengeRequestInFlight = useRef(false)
    const isMounted = useRef(true)

    const canSubmit = useMemo(() => /^\d{6}$/.test(code) && Boolean(challenge.challengeId), [challenge.challengeId, code])
    const challengeMessage = challenge.challengeId
        ? `Mã OTP đã được gửi đến ${challenge.maskedEmail ?? 'email đã cấu hình'}.`
        : isSending
            ? 'Đang gửi mã OTP đến email đã cấu hình.'
            : 'Chưa có mã OTP sẵn sàng. Vui lòng thử gửi lại.'

    function focusOtpDigit(index: number) {
        digitInputRefs.current[index]?.focus()
    }

    function updateOtpDigit(index: number, value: string) {
        const digit = value.replace(/\D/g, '').slice(-1)
        const nextCode = code.padEnd(6, '').split('')
        nextCode[index] = digit
        setCode(nextCode.join('').slice(0, 6))
        if (digit && index < 5) focusOtpDigit(index + 1)
    }

    function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Backspace') return
        if (code[index]) return
        if (index === 0) return

        event.preventDefault()
        const nextCode = code.padEnd(6, '').split('')
        nextCode[index - 1] = ''
        setCode(nextCode.join('').slice(0, 6))
        focusOtpDigit(index - 1)
    }

    function handleOtpPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
        const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6 - index)
        if (!digits) return

        event.preventDefault()
        const nextCode = code.padEnd(6, '').split('')
        digits.split('').forEach((digit, offset) => {
            nextCode[index + offset] = digit
        })
        setCode(nextCode.join('').slice(0, 6))
        focusOtpDigit(Math.min(index + digits.length, 5))
    }

    async function requestChallenge(endpoint: '/api/manager/otp/challenge' | '/api/manager/otp/resend', options?: { signal?: AbortSignal }) {
        if (isChallengeRequestInFlight.current) return

        isChallengeRequestInFlight.current = true
        const signal = options?.signal
        setIsSending(true)
        setMessage(null)
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: challenge.challengeId ? JSON.stringify({ challengeId: challenge.challengeId }) : undefined,
                signal,
            })
            const result = await response.json() as ApiResult
            if (signal?.aborted) return

            if (!response.ok || !result.ok || !result.challengeId) {
                setMessage(mapStatusToMessage(result.status))
                setChallenge((current) => ({
                    ...current,
                    challengeId: result.challengeId ?? current.challengeId,
                    maskedEmail: result.maskedEmail ?? current.maskedEmail,
                    expiresAt: result.expiresAt ?? current.expiresAt,
                    resendAvailableAt: result.resendAvailableAt ?? current.resendAvailableAt,
                }))
                return
            }

            setChallenge({
                challengeId: result.challengeId,
                maskedEmail: result.maskedEmail ?? initialMaskedEmail,
                expiresAt: result.expiresAt ?? null,
                resendAvailableAt: result.resendAvailableAt ?? null,
            })
            setCode('')
            setMessage('Mã OTP đã được gửi đến email đã cấu hình.')
        } catch {
            if (signal?.aborted) return
            setMessage('Không thể gửi mã OTP. Vui lòng thử lại hoặc liên hệ quản trị viên.')
        } finally {
            isChallengeRequestInFlight.current = false
            if (isMounted.current) setIsSending(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        isMounted.current = true
        void requestChallenge('/api/manager/otp/challenge', { signal: controller.signal })
        return () => {
            isMounted.current = false
            controller.abort()
        }
        // Run only once when the verification surface opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canSubmit || !challenge.challengeId) return

        setIsVerifying(true)
        setMessage(null)
        try {
            const response = await fetch('/api/manager/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeId: challenge.challengeId, code }),
            })
            const result = await response.json() as ApiResult

            if (!response.ok || !result.ok) {
                setMessage(mapStatusToMessage(result.status))
                return
            }

            window.location.replace(successRedirectPath)
        } catch {
            setMessage('Không thể xác thực mã OTP. Vui lòng thử lại.')
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <section className="rounded-md border border-white/80 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.14)] sm:p-8">
            <div className="space-y-7">
                <div className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#13235b] text-white shadow-[0_12px_30px_rgba(19,35,91,0.28)]">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-semibold tracking-[0.2em] text-[#3157c8] uppercase">Xác thực OTP</p>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Nhập mã xác thực</h1>
                        <p className="text-sm leading-6 text-slate-600">
                            {challengeMessage}
                        </p>
                    </div>
                </div>

                {message && (
                    <Alert className="rounded-md border-amber-200 bg-amber-50 text-amber-950">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{message}</AlertDescription>
                    </Alert>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-3">
                        <Label id="manager-otp-code-label" className="text-sm font-semibold text-slate-800">Mã OTP</Label>
                        <div
                            aria-labelledby="manager-otp-code-label"
                            className="grid grid-cols-6 gap-2 sm:gap-3"
                            role="group"
                        >
                            {Array.from({ length: 6 }, (_value, index) => (
                                <input
                                    key={index}
                                    ref={(element) => {
                                        digitInputRefs.current[index] = element
                                    }}
                                    aria-label={`Số OTP ${index + 1}`}
                                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                    className="h-12 min-w-0 rounded-md border border-slate-300 bg-white text-center text-xl font-semibold tabular-nums text-slate-950 shadow-xs outline-none transition focus:border-[#3157c8] focus:ring-3 focus:ring-[#3157c8]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14"
                                    inputMode="numeric"
                                    maxLength={1}
                                    pattern="[0-9]*"
                                    type="text"
                                    value={code[index] ?? ''}
                                    onChange={(event) => updateOtpDigit(index, event.target.value)}
                                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                                    onPaste={(event) => handleOtpPaste(index, event)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>Không nhận được mã?</span>
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={isSending}
                            className="h-8 px-2 text-xs font-semibold text-[#3157c8] hover:bg-[#eef4ff] hover:text-[#2445a8]"
                            onClick={() => requestChallenge(challenge.challengeId ? '/api/manager/otp/resend' : '/api/manager/otp/challenge')}
                        >
                            {isSending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCw className="mr-1.5 h-3.5 w-3.5" />}
                            {challenge.challengeId ? 'Gửi lại mã' : 'Thử gửi lại'}
                        </Button>
                    </div>

                    <Button
                        type="submit"
                        disabled={!canSubmit || isVerifying}
                        className="h-12 w-full rounded-md bg-[#3157c8] text-base font-semibold text-white shadow-[0_14px_28px_rgba(49,87,200,0.28)] transition hover:bg-[#2948a9] disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                    >
                        {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Xác nhận
                    </Button>
                </form>

                <p className="border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">
                    Email không đúng hoặc không nhận được mã? Vui lòng liên hệ quản trị viên để kiểm tra cấu hình OTP.
                </p>
            </div>
        </section>
    )
}
