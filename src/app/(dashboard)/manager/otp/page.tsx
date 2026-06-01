import Link from 'next/link'

export default function ManagerOtpPage() {
    return (
        <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center gap-4 px-6 py-10">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-slate-950">Xác thực email quản lý</h1>
                <p className="text-sm leading-6 text-slate-600">
                    Tính năng xác thực OTP email đang được bật cho tài khoản quản lý. Vui lòng liên hệ quản trị viên
                    nếu bạn chưa được cấp email nhận mã OTP.
                </p>
            </div>

            <Link
                href="/logout"
                className="inline-flex w-fit items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
                Đăng xuất
            </Link>
        </main>
    )
}
