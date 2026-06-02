import { ShieldAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function ManagerOtpProfileNotice() {
    return (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Email nhận OTP quản lý</AlertTitle>
            <AlertDescription>
                Bạn không thể tự thay đổi email nhận OTP quản lý trong hồ sơ cá nhân. Vui lòng liên hệ quản trị viên
                để cập nhật thông tin này.
            </AlertDescription>
        </Alert>
    )
}
