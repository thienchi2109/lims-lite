import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, List, BarChart3, ShieldCheck } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard-header'

export default async function AnalystDashboard() {
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

    const menuItems = [
        {
            title: "Tiếp nhận mẫu",
            description: "Tiếp nhận mẫu mới vào hệ thống. Sử dụng máy quét QR hoặc nhập thủ công.",
            icon: Plus,
            href: "/analyst/accession",
            color: "from-emerald-500 to-teal-600",
            iconColor: "text-emerald-50"
        },
        {
            title: "Danh sách mẫu",
            description: "Xem và quản lý tất cả các mẫu. Tìm kiếm, lọc và chỉnh sửa thông tin.",
            icon: List,
            href: "/analyst/samples",
            color: "from-blue-500 to-indigo-600",
            iconColor: "text-blue-50"
        },
        {
            title: "Nhập kết quả IQC",
            description: "Nhập và theo dõi kết quả kiểm soát chất lượng nội bộ (IQC) hàng ngày.",
            icon: ShieldCheck,
            href: "/analyst/qc-entry",
            color: "from-amber-500 to-orange-600",
            iconColor: "text-amber-50"
        },
        {
            title: "Báo cáo",
            description: "Xem báo cáo và phân tích hiệu suất phòng lab. Theo dõi TAT và tỷ lệ hoàn thành.",
            icon: BarChart3,
            href: "/analyst/reports",
            color: "from-orange-500 to-red-600",
            iconColor: "text-orange-50"
        }
    ]

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-50/60 to-transparent dark:from-emerald-950/20 pointer-events-none" />
            <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-teal-200/20 dark:bg-teal-900/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-[200px] left-[-100px] w-[300px] h-[300px] bg-emerald-200/20 dark:bg-emerald-900/10 rounded-full blur-3xl pointer-events-none" />

            <DashboardHeader
                subtitle="Bảng điều khiển Kiểm nghiệm viên"
                user={userData}
                className="relative z-10"
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                {/* Hero / Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                        Xin chào, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400">{userData?.full_name}</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base max-w-2xl">
                        Chào mừng trở lại. Hãy bắt đầu phiên làm việc của bạn.
                    </p>
                </div>

                {/* Dashboard Grid */}
                {/* Dashboard Grid - Compact Modern Design */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group relative"
                        >
                            <div className="h-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-900/20 hover:border-emerald-500/30 dark:hover:border-emerald-400/30 hover:-translate-y-1 overflow-hidden">

                                {/* Hover Gradient subtle */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} bg-opacity-10 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                            <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={2.5} />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                            {item.description}
                                        </p>
                                    </div>

                                    {/* Arrow indicator that appears on hover */}
                                    <div className="absolute bottom-4 right-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                        <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
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
