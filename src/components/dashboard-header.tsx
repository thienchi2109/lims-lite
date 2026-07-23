'use client'

import { UserProfileDropdown } from '@/components/user-profile-dropdown'
import { DashboardNav } from '@/components/dashboard-nav'
import { GlobalSearch } from '@/components/global-search'
import { ScannerConnectionButton } from '@/components/scanner/scanner-connection-button'
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
    title = 'CDC-LIMS Pro',
    subtitle,
    user,
    className,
}: DashboardHeaderProps) {
    const canUseGlobalSearch = user?.role !== 'doctor'

    return (
        <header
            className={cn(
                'sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-xl transition-all duration-200 supports-[backdrop-filter]:bg-white/60 dark:border-slate-800/60 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/60',
                className,
            )}
        >
            <div
                id="dashboard-header-mobile-row"
                data-testid="dashboard-header-mobile-row"
                className="flex h-[80px] items-center justify-between gap-2 px-4 py-3.5 md:hidden sm:px-6"
            >
                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden sm:gap-4">
                    <DashboardNav
                        user={user}
                        variant="mobile"
                        className="mr-1 shrink-0"
                    />
                    <div className="relative h-[42px] w-[42px] shrink-0 sm:h-[46px] sm:w-[46px]">
                        <Image
                            src="/cdc-logo-400x400.png"
                            alt="CDC Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <div className="flex min-w-0 flex-col">
                        <h1 className="truncate bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text pr-2 text-lg font-bold tracking-tight text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 sm:text-xl">
                            {title}
                        </h1>
                        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                    {canUseGlobalSearch && <GlobalSearch variant="compact" />}
                    <ScannerConnectionButton />
                    {user && (
                        <>
                            <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
                            <UserProfileDropdown user={user} variant="responsive" />
                        </>
                    )}
                </div>
            </div>

            <div
                id="dashboard-header-compact-row"
                data-testid="dashboard-header-compact-row"
                className="hidden h-[64px] w-full items-center gap-2 px-3 md:flex min-[1800px]:hidden lg:px-4"
            >
                <div className="flex shrink-0 items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0">
                        <Image
                            src="/cdc-logo-400x400.png"
                            alt="CDC Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <h1 className="shrink-0 whitespace-nowrap bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-sm font-bold tracking-tight text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">
                        {title}
                    </h1>
                </div>

                <div className="flex shrink-0 items-center">
                    <DashboardNav
                        user={user}
                        variant="compact"
                        className="shrink-0"
                    />
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {canUseGlobalSearch && (
                        <GlobalSearch variant="compact" skipShortcut />
                    )}
                    <ScannerConnectionButton />
                    {user && (
                        <>
                            <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 lg:block" />
                            <UserProfileDropdown user={user} variant="compact" />
                        </>
                    )}
                </div>
            </div>

            <div
                id="dashboard-header-full-row"
                data-testid="dashboard-header-full-row"
                className="mx-auto hidden h-[64px] w-full max-w-[1920px] items-center gap-5 px-8 py-2 min-[1800px]:flex"
            >
                <div className="flex shrink-0 items-center gap-4">
                    <div className="relative h-[38px] w-[38px] shrink-0">
                        <Image
                            src="/cdc-logo-400x400.png"
                            alt="CDC Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <div className="flex min-w-0 flex-col">
                        <h1 className="truncate bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-xl font-bold tracking-tight text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">
                            {title}
                        </h1>
                        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                            {subtitle}
                        </p>
                    </div>
                </div>

                {canUseGlobalSearch && (
                    <div
                        id="dashboard-header-full-search"
                        data-testid="dashboard-header-full-search"
                        className="min-w-[18rem] flex-1 max-w-sm 2xl:max-w-md"
                    >
                        <GlobalSearch
                            variant="full"
                            className="w-full shadow-sm"
                            skipShortcut
                        />
                    </div>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-4 2xl:gap-6">
                    <DashboardNav
                        user={user}
                        variant="full"
                        className="shrink-0 whitespace-nowrap"
                    />
                    <ScannerConnectionButton />
                    {user && (
                        <>
                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                            <UserProfileDropdown user={user} variant="full" />
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
