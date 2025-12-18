'use client'

import { UserProfileDropdown } from '@/components/user-profile-dropdown'
import { DashboardNav } from '@/components/dashboard-nav'
import { GlobalSearch } from '@/components/global-search'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface DashboardHeaderProps {
    title?: string
    subtitle: string
    user?: {
        full_name: string | null
        role: string | null
    } | null
    className?: string
}

export function DashboardHeader({
    title = "Hệ Thống Quản Lý Thông Tin Khoa Xét nghiệm",
    subtitle,
    user,
    className
}: DashboardHeaderProps) {
    return (
        <header className={cn(
            "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 sm:px-6 lg:px-8 py-3 transition-all duration-200",
            className
        )}>
            <div className="flex justify-between items-center max-w-[1920px] mx-auto">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                        <Image
                            src="/cdc-logo-400x400.png"
                            alt="CDC Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 dark:from-blue-400 dark:via-blue-300 dark:to-indigo-400 bg-clip-text text-transparent">
                            {title}
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6">
                    <GlobalSearch />
                    <DashboardNav user={user} />
                    {user && <UserProfileDropdown user={user} />}
                </div>
            </div>
        </header>
    )
}
