'use client'

import Link from 'next/link'
import { FlaskConical, CheckCircle2, ClipboardList, User, QrCode, BarChart3, ShieldCheck, ContactRound } from 'lucide-react'
import { DashboardAlertBanner } from '@/components/dashboard-alert-banner'
import { useApprovalCount } from '@/hooks/use-approval-count'

interface ManagerDashboardClientProps {
    user: {
        full_name: string
    }
}

export function ManagerDashboardClient({ user }: ManagerDashboardClientProps) {
    const { data: pendingCount = 0 } = useApprovalCount()

    const menuItems = [
        {
            title: "Quản lý mẫu",
            description: "Xem tất cả mẫu, chỉ định xét nghiệm và quản lý quy trình",
            icon: FlaskConical,
            href: "/manager/samples",
            color: "from-blue-500 to-indigo-600",
            iconColor: "text-blue-50"
        },
        {
            title: "Hàng đợi phê duyệt",
            description: "Xem xét và phê duyệt kết quả xét nghiệm",
            icon: CheckCircle2,
            href: "/manager/approvals",
            color: "from-emerald-500 to-teal-600",
            iconColor: "text-emerald-50",
            badge: pendingCount > 0 ? pendingCount : null
        },
        {
            title: "Chỉ tiêu xét nghiệm",
            description: "Quản lý danh mục chỉ tiêu",
            icon: ClipboardList,
            href: "/manager/assays",
            color: "from-violet-500 to-purple-600",
            iconColor: "text-violet-50"
        },
        {
            title: "Báo cáo & Phân tích",
            description: "Xem báo cáo và phân tích hiệu suất phòng lab",
            icon: BarChart3,
            href: "/manager/reports",
            color: "from-orange-500 to-red-600",
            iconColor: "text-orange-50"
        },
        {
            title: "Quản lý người dùng",
            description: "Quản lý tài khoản và phân quyền",
            icon: User,
            href: "/manager/users",
            color: "from-pink-500 to-rose-600",
            iconColor: "text-pink-50"
        },
        {
            title: "Quản lý khách hàng",
            description: "Vòng đời, hiệu chỉnh và xử lý xung đột",
            icon: ContactRound,
            href: "/manager/clients",
            color: "from-lime-600 to-emerald-700",
            iconColor: "text-lime-50"
        },
        {
            title: "Mã QR Cổng Tra Cứu",
            description: "Tạo và in mã QR cho khách hàng tự tra cứu",
            icon: QrCode,
            href: "/manager/qr-code",
            color: "from-cyan-500 to-sky-600",
            iconColor: "text-cyan-50"
        },
        {
            title: "Kiểm soát chất lượng kết quả xét nghiệm (IQC)",
            description: "Quản lý IQC, Westgard rules và phân tích Sigma",
            icon: ShieldCheck,
            href: "/manager/quality-control",
            color: "from-amber-500 to-orange-600",
            iconColor: "text-amber-50"
        }
    ]

    return (
        <>
            {/* Hero / Welcome Section */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    Xin chào, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{user.full_name}</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-base max-w-2xl">
                    Chào mừng trở lại hệ thống CDC LIMS-Lite. Hãy theo dõi các tác vụ phê duyệt và quản trị bên dưới.
                </p>
            </div>

            <DashboardAlertBanner
                count={pendingCount}
                variant="warning"
                message="Bạn có {count} mẫu đang chờ phê duyệt"
                linkText="Mở hàng đợi"
                linkHref="/manager/approvals"
            />

            {/* Dashboard Grid */}
            <div
                className={
                    pendingCount > 0
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-8'
                        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-0'
                }
            >
                {menuItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="group relative"
                    >
                        <div className="h-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 dark:hover:shadow-indigo-900/20 hover:border-indigo-500/30 dark:hover:border-indigo-400/30 hover:-translate-y-1 overflow-hidden">

                            {/* Hover Gradient subtle */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} bg-opacity-10 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                        <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={2.5} />
                                    </div>

                                    {item.badge && (
                                        <span className="flex px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                                            {item.badge}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
                                        {item.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                        {item.description}
                                    </p>
                                </div>

                                {/* Arrow indicator */}
                                <div className="absolute bottom-4 right-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                    <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </>
    )
}
