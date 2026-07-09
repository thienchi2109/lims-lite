import { LogoutButton } from '@/components/logout-button'
import { ManagerOtpVerificationForm } from '@/components/manager-otp-verification-form'
import { maskManagerOtpEmail } from '@/lib/manager-email-otp/server-records'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ManagerOtpPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: userData } = await supabase
        .from('users')
        .select('full_name, role, can_access_confidential')
        .eq('id', user.id)
        .single()

    const canUseOtpRoute = userData?.role === 'manager' ||
        (userData?.role === 'analyst' && userData.can_access_confidential === true)

    if (!userData || !canUseOtpRoute) {
        redirect('/login')
    }

    const { data: otpSettings } = await supabase
        .from('manager_otp_settings')
        .select('otp_email')
        .eq('user_id', user.id)
        .single()
    const maskedOtpEmail = otpSettings?.otp_email ? maskManagerOtpEmail(otpSettings.otp_email) : null

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#eef4ff] px-4 py-8 text-slate-950 sm:px-6">
            <div className="flex w-full max-w-[440px] flex-col gap-5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span className="tracking-[0.18em] text-slate-700 uppercase">CDC-LIMS Pro</span>
                    <span>{userData.role === 'analyst' ? 'Kỹ thuật viên' : 'Quản lý'}</span>
                </div>

                {maskedOtpEmail ? (
                    <ManagerOtpVerificationForm
                        initialMaskedEmail={maskedOtpEmail}
                        successRedirectPath={userData.role === 'analyst' ? '/analyst' : '/manager'}
                    />
                ) : (
                    <section className="rounded-md border border-amber-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-amber-700">Chưa cấu hình email OTP</p>
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Cần cấu hình email nhận mã</h1>
                            <p className="text-sm leading-6 text-slate-600">
                                Vui lòng liên hệ quản trị viên để cấu hình email nhận OTP trong Quản lý người dùng cho tài
                                khoản của bạn trước khi tiếp tục.
                            </p>
                        </div>
                    </section>
                )}

                <LogoutButton />
            </div>
        </main>
    )
}
