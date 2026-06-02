import { DashboardHeader } from '@/components/dashboard-header'
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
        .select('full_name, role')
        .eq('id', user.id)
        .single()

    if (!userData || userData.role !== 'manager') {
        redirect('/login')
    }

    const { data: otpSettings } = await supabase
        .from('manager_otp_settings')
        .select('otp_email')
        .eq('user_id', user.id)
        .single()
    const maskedOtpEmail = otpSettings?.otp_email ? maskManagerOtpEmail(otpSettings.otp_email) : null

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <DashboardHeader
                subtitle="Xác thực email quản lý"
                user={userData}
            />

            <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center gap-5 px-6 py-10">
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold text-slate-950">Xác thực email quản lý</h1>
                    <p className="text-sm leading-6 text-slate-600">
                        Tính năng xác thực OTP email đang được bật cho tài khoản quản lý. Vui lòng liên hệ quản trị viên
                        nếu bạn chưa được cấp email nhận mã OTP.
                    </p>
                </div>

                {maskedOtpEmail ? (
                    <ManagerOtpVerificationForm initialMaskedEmail={maskedOtpEmail} />
                ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                        Quản trị viên cần vào Quản lý người dùng để cấu hình email nhận OTP cho tài khoản của bạn trước
                        khi bạn có thể tiếp tục.
                    </p>
                )}

                <LogoutButton />
            </main>
        </div>
    )
}
