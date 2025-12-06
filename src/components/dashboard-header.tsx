import { LogoutButton } from '@/components/logout-button'
import { Beaker } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    title = "Hệ thống quản lý thông tin khoa Xét nghiệm", 
    subtitle, 
    user,
    className 
}: DashboardHeaderProps) {
    return (
        <header className={cn(
            "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 sm:px-6 lg:px-8 py-4 transition-all duration-200",
            className
        )}>
            <div className="flex justify-between items-center max-w-[1920px] mx-auto">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50 hidden sm:block">
                        <Beaker className="w-6 h-6 text-blue-600 dark:text-blue-400" />
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
                    {user && (
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {user.full_name}
                            </p>
                            <div className="flex items-center justify-end gap-1.5">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize font-medium">
                                    {user.role}
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                    <LogoutButton />
                </div>
            </div>
        </header>
    )
}
