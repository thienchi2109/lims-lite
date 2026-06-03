'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'

import { configureManagerOtpEmailClient, getMaskedManagerOtpEmailClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ManagerOtpTargetUser = {
    id: string
    full_name?: string | null
    role: string
}

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getOtpActionErrorMessage(error: unknown) {
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message
        if (typeof message === 'string' && message) return message
    }
    return 'Không thể cập nhật email OTP'
}

export function ManagerOtpEmailDialog({
    open,
    onOpenChange,
    user,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: ManagerOtpTargetUser | null
}) {
    const router = useRouter()
    const [otpEmail, setOtpEmail] = useState('')
    const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const canSave = useMemo(() => Boolean(user?.id) && isValidEmail(otpEmail), [otpEmail, user?.id])

    useEffect(() => {
        if (!open || !user?.id) return

        let cancelled = false
        setMaskedEmail(null)
        setOtpEmail('')
        setIsLoading(true)
        getMaskedManagerOtpEmailClient(user.id)
            .then((result) => {
                if (!cancelled) setMaskedEmail(result.otpEmail ?? null)
            })
            .catch(() => {
                if (!cancelled) toast.error('Không thể tải email OTP hiện tại')
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [open, user?.id])

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!user?.id || !canSave) return

        setIsSaving(true)
        try {
            const result = await configureManagerOtpEmailClient({ userId: user.id, otpEmail })
            if (result && typeof result === 'object' && 'error' in result) {
                toast.error(getOtpActionErrorMessage(result.error))
                return
            }

            toast.success('Đã cập nhật email nhận OTP')
            router.refresh()
            onOpenChange(false)
        } catch {
            toast.error('Không thể cập nhật email OTP')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
                        <KeyRound className="h-5 w-5" />
                    </div>
                    <DialogTitle>Cấu hình email OTP quản lý</DialogTitle>
                    <DialogDescription>
                        Cập nhật email nhận mã OTP cho {user?.full_name ?? 'tài khoản quản lý'}.
                    </DialogDescription>
                </DialogHeader>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="flex items-center gap-2 font-medium text-slate-950">
                            <MailCheck className="h-4 w-4" />
                            Email hiện tại
                        </div>
                        <p className="mt-2">{isLoading ? 'Đang tải...' : maskedEmail ?? 'Chưa cấu hình email nhận OTP'}</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="manager-otp-email">Email nhận OTP</Label>
                        <Input
                            id="manager-otp-email"
                            type="email"
                            value={otpEmail}
                            onChange={(event) => setOtpEmail(event.target.value)}
                            placeholder="otp@example.com"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Hủy
                        </Button>
                        <Button type="submit" disabled={!canSave || isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Lưu email OTP
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
