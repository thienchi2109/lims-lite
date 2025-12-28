'use client'

import { UserProfileDropdown } from '@/components/user-profile-dropdown'
import { DashboardNav } from '@/components/dashboard-nav'
import { GlobalSearch } from '@/components/global-search'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import type { UserRole } from '@/types'

interface DashboardHeaderProps {
    title?: string
    subtitle: string
    user?: {
        full_name: string | null
        role: UserRole | null
    } | null
    className?: string
}

export function DashboardHeader({
    title = "CDC-LIMS Pro",
    subtitle,
    user,
    className
}: DashboardHeaderProps) {
    return (
        <header className={cn(
            "sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm transition-all duration-200 supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-950/60",
            className
        )}>
            {/* Desktop Layout (Two Rows) */}
            <div className="hidden xl:flex flex-col">
                {/* Top Row: Search Only */}
                <div className="border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-center px-8 py-2 h-[52px] max-w-[1920px] mx-auto">
                        <div className="flex-1 max-w-3xl">
                            <GlobalSearch variant="full" className="w-full shadow-sm" skipShortcut />
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Branding, Nav, User */}
                <div className="px-8 py-2 h-[60px] max-w-[1920px] mx-auto w-full flex items-center justify-between">
                    {/* Left: Logo & Title */}
                    <div className="flex items-center gap-4">
                        <div className="relative h-[38px] w-[38px] shrink-0">
                            <Image
                                src="/cdc-logo-400x400.png"
                                alt="CDC Logo"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent truncate">
                                {title}
                            </h1>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                                {subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Right: Nav & User */}
                    <div className="flex items-center gap-6">
                        <DashboardNav user={user} className="flex" />
                        {user && (
                            <>
                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                                <UserProfileDropdown user={user} />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile/Tablet Layout (Single Row) */}
            <div className="xl:hidden flex justify-between items-center px-4 sm:px-6 py-3.5 h-[80px]">
                <div className="flex items-center gap-3 sm:gap-4 overflow-hidden min-w-fit">
                    <DashboardNav user={user} className="mr-1" />
                    <div className="relative h-[42px] w-[42px] sm:h-[46px] sm:w-[46px] shrink-0">
                        <Image
                            src="/cdc-logo-400x400.png"
                            alt="CDC Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent truncate pr-2">
                            {title}
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <GlobalSearch variant="compact" />
                    {user && (
                        <>
                            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                            <UserProfileDropdown user={user} />
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
