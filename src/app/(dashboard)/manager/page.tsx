import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, CheckCircle2, ClipboardList, User, QrCode } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard-header'
import { getSamplesForApprovalCount } from '@/app/actions/samples'

export default async function ManagerDashboard() {
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

    const { data: pendingCountData } = await getSamplesForApprovalCount()
    const pendingCount = pendingCountData ?? 0

    const menuItems = [
        {
            title: "Quản lý mẫu",
            description: "Xem tất cả mẫu, chỉ định xét nghiệm và quản lý quy trình",
            icon: FlaskConical,
            href: "/manager/samples",
            color: "from-blue-500 to-indigo-600",
            iconColor: "text-blue-50",
            delay: "animate-delay-100"
        },
        {
            title: "Hàng đợi phê duyệt",
            description: "Xem xét và phê duyệt kết quả xét nghiệm",
            icon: CheckCircle2,
            href: "/manager/approvals",
            color: "from-emerald-500 to-teal-600",
            iconColor: "text-emerald-50",
            badge: pendingCount > 0 ? pendingCount : null,
            delay: "animate-delay-200"
        },
        {
            title: "Chỉ tiêu xét nghiệm",
            description: "Quản lý danh mục chỉ tiêu",
            icon: ClipboardList,
            href: "/manager/assays",
            color: "from-violet-500 to-purple-600",
            iconColor: "text-violet-50",
            delay: "animate-delay-300"
        },
        {
            title: "Quản lý người dùng",
            description: "Quản lý tài khoản và phân quyền",
            icon: User,
            href: "/manager/users",
            color: "from-pink-500 to-rose-600",
            iconColor: "text-pink-50",
            delay: "animate-delay-400"
        },
        {
            title: "Mã QR Cổng Tra Cứu",
            description: "Tạo và in mã QR cho khách hàng tự tra cứu",
            icon: QrCode,
            href: "/manager/qr-code",
            color: "from-cyan-500 to-sky-600",
            iconColor: "text-cyan-50",
            delay: "animate-delay-500"
        }
    ]

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/80 to-transparent dark:from-blue-950/20 pointer-events-none" />
            <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-[200px] left-[-100px] w-[300px] h-[300px] bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />

            <DashboardHeader
                subtitle="Bảng điều khiển Quản lý"
                user={userData}
                className="relative z-10"
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
                {/* Hero / Welcome Section */}
                <div className="mb-12 animate-fade-in-up">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                        Xin chào, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{userData?.full_name}</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl">
                        Chào mừng trở lại hệ thống CDC LIMS-Lite. Bạn có <span className="font-semibold text-slate-900 dark:text-white">{pendingCount} mẫu</span> đang chờ phê duyệt.
                    </p>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group relative animate-fade-in-up ${item.delay}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 shadow-xl pointer-events-none" />

                            <div className="relative h-full bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-blue-200/50 dark:hover:border-blue-800/50 overflow-hidden">
                                {/* Hover Gradient Glow */}
                                <div className={`absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500`} />

                                <div className="flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-4 rounded-2xl bg-gradient-to-br ${item.color} shadow-lg shadow-blue-900/5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                                            <item.icon className={`h-7 w-7 ${item.iconColor}`} strokeWidth={2} />
                                        </div>

                                        {item.badge && (
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white text-sm font-bold shadow-lg ring-4 ring-white/50 dark:ring-slate-900/50 animate-pulse">
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    )
}
