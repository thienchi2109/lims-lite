'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Menu,
    LayoutDashboard,
    FlaskConical,
    CheckCircle2,
    ClipboardList,
    User,
    Plus,
    List,
    QrCode,
    BarChart3,
    ShieldCheck,
} from 'lucide-react'
import type { UserRole } from '@/types'

type DashboardNavVariant = 'mobile' | 'compact' | 'full'

interface DashboardNavProps {
    user?: {
        role: UserRole | null
    } | null
    variant: DashboardNavVariant
    className?: string
}

export function DashboardNav({ user, variant, className }: DashboardNavProps) {
    const pathname = usePathname()
    const [open, setOpen] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        if (variant === 'mobile') {
            setIsMounted(true)
        }
    }, [variant])

    if (!user || !user.role) return null

    const role = user.role

    const links = role === 'manager'
        ? [
            { href: '/manager', label: 'Trang chủ', icon: LayoutDashboard },
            { href: '/manager/samples', label: 'Quản lý mẫu', icon: FlaskConical },
            { href: '/manager/approvals', label: 'Phê duyệt', icon: CheckCircle2 },
            { href: '/manager/assays', label: 'Chỉ tiêu', icon: ClipboardList },
            { href: '/manager/quality-control', label: 'QA/QC', icon: ShieldCheck },
            { href: '/manager/users', label: 'Người dùng', icon: User },
            { href: '/manager/reports', label: 'Báo cáo', icon: BarChart3 },
            { href: '/manager/qr-code', label: 'Mã QR', icon: QrCode },
        ]
        : role === 'analyst'
            ? [
                { href: '/analyst', label: 'Trang chủ', icon: LayoutDashboard },
                { href: '/analyst/accession', label: 'Tiếp nhận', icon: Plus },
                { href: '/analyst/samples', label: 'Danh sách mẫu', icon: List },
                { href: '/analyst/qc-entry', label: 'Nhập IQC', icon: ShieldCheck },
                { href: '/analyst/reports', label: 'Báo cáo', icon: BarChart3 },
            ]
            : []

    if (links.length === 0) return null

    const navigationItems = links.map((link) => ({
        ...link,
        isActive: pathname === link.href
            || (pathname?.startsWith(link.href) && link.href !== `/${role}`),
    }))

    if (variant === 'full') {
        return (
            <div className={cn('flex items-center', className)}>
                <nav
                    aria-label="Điều hướng chính"
                    className="mx-6 flex shrink-0 items-center gap-1 whitespace-nowrap"
                >
                    {navigationItems.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            aria-current={link.isActive ? 'page' : undefined}
                            className={cn(
                                'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                                link.isActive
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200',
                            )}
                        >
                            <link.icon
                                aria-hidden="true"
                                className={cn(
                                    'h-4 w-4',
                                    link.isActive
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-slate-500',
                                )}
                            />
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </div>
        )
    }

    if (variant === 'compact') {
        return (
            <div className={cn('flex items-center', className)}>
                <nav
                    aria-label="Điều hướng chính"
                    className="flex shrink-0 items-center gap-1"
                >
                    {navigationItems.map((link) => (
                        <Tooltip key={link.href}>
                            <TooltipTrigger asChild>
                                <Link
                                    href={link.href}
                                    aria-label={link.label}
                                    aria-current={link.isActive ? 'page' : undefined}
                                    className={cn(
                                        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                                        'dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950',
                                        link.isActive
                                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                                    )}
                                >
                                    <link.icon aria-hidden="true" className="h-4 w-4" />
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6}>
                                {link.label}
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </nav>
            </div>
        )
    }

    return (
        <div className={cn('flex items-center', className)}>
            {isMounted && (
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
                        >
                            <Menu aria-hidden="true" className="h-6 w-6" />
                            <span className="sr-only">Mở menu điều hướng</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] p-0 sm:w-[400px]">
                        <SheetHeader className="border-b border-slate-100 p-6 dark:border-slate-800">
                            <SheetTitle className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-left text-2xl font-bold text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">
                                CDC-LIMS Pro
                            </SheetTitle>
                        </SheetHeader>
                        <nav className="flex flex-col gap-2 p-4">
                            {navigationItems.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    aria-current={link.isActive ? 'page' : undefined}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        'flex items-center gap-4 rounded-xl px-4 py-4 text-base font-medium transition-all duration-200',
                                        link.isActive
                                            ? 'bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-900/20 dark:text-blue-400'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200',
                                    )}
                                >
                                    <link.icon
                                        aria-hidden="true"
                                        className={cn(
                                            'h-6 w-6',
                                            link.isActive
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-slate-500',
                                        )}
                                    />
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    </SheetContent>
                </Sheet>
            )}
        </div>
    )
}
