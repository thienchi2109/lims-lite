import { OTP_STEP_UP_ROUTE } from '@/lib/manager-email-otp/routes'
import { redirect } from 'next/navigation'

export default async function ManagerOtpPage() {
    redirect(OTP_STEP_UP_ROUTE)
}
