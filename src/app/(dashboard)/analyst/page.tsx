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

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
                {/* Hero / Welcome Section */}
                <div className="mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                        Xin chào, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400">{userData?.full_name}</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl">
                        Chào mừng trở lại. Hãy bắt đầu phiên làm việc của bạn.
                    </p>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group relative"
                        >
                            {/* Neumorphism Card */}
                            <div className="relative h-full bg-slate-50 dark:bg-slate-950 rounded-3xl p-6 transition-all duration-300 ease-out
                                shadow-[9px_9px_16px_#cbd5e1,-9px_-9px_16px_#ffffff]
                                dark:shadow-[10px_10px_20px_#020617,-10px_-10px_20px_#1e293b]
                                hover:shadow-[12px_12px_24px_#cbd5e1,-12px_-12px_24px_#ffffff]
                                dark:hover:shadow-[14px_14px_28px_#020617,-14px_-14px_28px_#1e293b]
                                hover:scale-[1.02] hover:-translate-y-1 overflow-hidden">

                                {/* Hover Gradient Glow (Subtle) */}
                                <div className={`absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500`} />

                                <div className="flex flex-col h-full relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`p-4 rounded-2xl bg-gradient-to-br ${item.color} shadow-lg shadow-emerald-900/10 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                                            <item.icon className={`h-7 w-7 ${item.iconColor} transition-transform duration-300 group-hover:scale-110`} strokeWidth={2} />
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors duration-300">
                                            {item.title}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed transition-colors duration-300 group-hover:text-slate-600 dark:group-hover:text-slate-300">
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
