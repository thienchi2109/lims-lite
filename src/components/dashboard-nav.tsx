'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
    Menu,
    LayoutDashboard,
    FlaskConical,
    CheckCircle2,
    ClipboardList,
    User,
    Plus,
    List,
    QrCode
} from 'lucide-react'

interface DashboardNavProps {
    user?: {
        role: string | null
    } | null
    className?: string
}

export function DashboardNav({ user, className }: DashboardNavProps) {
    const pathname = usePathname()
    const [open, setOpen] = React.useState(false)

    if (!user || !user.role) return null

    const role = user.role

    const links = role === 'manager'
        ? [
            { href: '/manager', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/manager/samples', label: 'Quản lý mẫu', icon: FlaskConical },
            { href: '/manager/approvals', label: 'Phê duyệt', icon: CheckCircle2 },
            { href: '/manager/assays', label: 'Chỉ tiêu', icon: ClipboardList },
            { href: '/manager/users', label: 'Người dùng', icon: User },
            { href: '/manager/qr-code', label: 'Mã QR', icon: QrCode },
        ]
        : role === 'analyst'
            ? [
                { href: '/analyst', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/analyst/accession', label: 'Tiếp nhận', icon: Plus },
                { href: '/analyst/samples', label: 'Danh sách mẫu', icon: List },
            ]
            : []

    return (
        <div className={cn("flex items-center", className)}>
            {/* Desktop Navigation */}
            <nav className="hidden xl:flex items-center gap-1 mx-6">
                {links.map((link) => {
                    const isActive = pathname === link.href || (pathname?.startsWith(link.href) && link.href !== `/` + role)

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                                isActive
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
                            )}
                        >
                            <link.icon className={cn("h-4 w-4", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500")} />
                            {link.label}
                        </Link>
                    )
                })}
            </nav>

            {/* Mobile Navigation */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="xl:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0">
                    <SheetHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
                        <SheetTitle className="text-left bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent font-bold text-2xl">
                            CDC-LIMS Pro
                        </SheetTitle>
                    </SheetHeader>
                    <nav className="flex flex-col gap-2 p-4">
                        {links.map((link) => {
                            const isActive = pathname === link.href || (pathname?.startsWith(link.href) && link.href !== `/` + role)

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center gap-4 px-4 py-4 text-base font-medium rounded-xl transition-all duration-200",
                                        isActive
                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 shadow-sm"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
                                    )}
                                >
                                    <link.icon className={cn("h-6 w-6", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500")} />
                                    {link.label}
                                </Link>
                            )
                        })}
                    </nav>
                </SheetContent>
            </Sheet>
        </div>
    )
}
