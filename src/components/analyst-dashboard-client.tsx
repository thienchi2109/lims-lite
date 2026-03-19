'use client'

import Link from 'next/link'
import { BarChart3, List, Plus, ShieldCheck } from 'lucide-react'
import { DashboardAlertBanner } from '@/components/dashboard-alert-banner'
import { Badge } from '@/components/ui/badge'
import { useRejectionCount } from '@/hooks/use-rejection-count'
import { cn } from '@/lib/utils'

interface AnalystDashboardClientProps {
    user: {
        full_name: string | null
    } | null
}

export function AnalystDashboardClient({ user }: AnalystDashboardClientProps) {
    const { data: rejectionCount = 0 } = useRejectionCount()
    const displayName = user?.full_name ?? 'bạn'

    const menuItems = [
        {
            title: 'Tiếp nhận mẫu',
            description:
                'Tiếp nhận mẫu mới vào hệ thống. Sử dụng máy quét QR hoặc nhập thủ công.',
            icon: Plus,
            href: '/analyst/accession',
            color: 'from-emerald-500 to-teal-600',
            iconColor: 'text-emerald-50',
        },
        {
            title: 'Danh sách mẫu',
            description:
                'Xem và quản lý tất cả các mẫu. Tìm kiếm, lọc và chỉnh sửa thông tin.',
            icon: List,
            href: '/analyst/samples',
            color: 'from-blue-500 to-indigo-600',
            iconColor: 'text-blue-50',
            badge: rejectionCount > 0 ? rejectionCount : null,
        },
        {
            title: 'Nhập kết quả IQC',
            description:
                'Nhập và theo dõi kết quả kiểm soát chất lượng nội bộ (IQC) hàng ngày.',
            icon: ShieldCheck,
            href: '/analyst/qc-entry',
            color: 'from-amber-500 to-orange-600',
            iconColor: 'text-amber-50',
        },
        {
            title: 'Báo cáo',
            description:
                'Xem báo cáo và phân tích hiệu suất phòng lab. Theo dõi TAT và tỷ lệ hoàn thành.',
            icon: BarChart3,
            href: '/analyst/reports',
            color: 'from-orange-500 to-red-600',
            iconColor: 'text-orange-50',
        },
    ]

    return (
        <>
            <div className="mb-8">
                <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                    Xin chào,{' '}
                    <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
                        {displayName}
                    </span>
                </h1>
                <p className="max-w-2xl text-base text-slate-500 dark:text-slate-400">
                    Chào mừng trở lại. Hãy bắt đầu phiên làm việc của bạn.
                </p>
            </div>

            <DashboardAlertBanner
                count={rejectionCount}
                variant="error"
                message="Bạn có {count} mẫu bị từ chối"
                linkText="Mở danh sách mẫu"
                linkHref="/samples"
            />

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {menuItems.map((item) => (
                    <Link key={item.href} href={item.href} className="group relative">
                        <div className="h-full overflow-hidden rounded-2xl border border-slate-200/50 bg-white/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 dark:border-slate-800/50 dark:bg-slate-900/60 dark:hover:border-indigo-400/30 dark:hover:shadow-indigo-900/20 backdrop-blur-xl">
                            <div
                                className={cn(
                                    'absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-[0.03]',
                                    item.color,
                                )}
                            />

                            <div className="relative z-10 flex h-full flex-col">
                                <div className="mb-4 flex items-start justify-between">
                                    <div
                                        className={cn(
                                            'rounded-xl bg-gradient-to-br p-2.5 shadow-sm transition-transform duration-300 group-hover:scale-110',
                                            item.color,
                                        )}
                                    >
                                        <item.icon
                                            className={cn('h-5 w-5', item.iconColor)}
                                            strokeWidth={2.5}
                                        />
                                    </div>

                                    {item.badge ? (
                                        <Badge
                                            variant="destructive"
                                            className="rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ring-2 ring-white dark:ring-slate-900"
                                        >
                                            {item.badge}
                                        </Badge>
                                    ) : null}
                                </div>

                                <div>
                                    <h3 className="mb-1.5 text-base font-bold text-slate-800 transition-colors duration-200 group-hover:text-emerald-600 dark:text-slate-100 dark:group-hover:text-emerald-400">
                                        {item.title}
                                    </h3>
                                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        {item.description}
                                    </p>
                                </div>

                                <div className="absolute bottom-4 right-4 translate-x-[-8px] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                                    <svg
                                        className="h-4 w-4 text-emerald-500 dark:text-emerald-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                                        />
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
