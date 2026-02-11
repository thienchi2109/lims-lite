import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { FlaskConical, Activity, Package, GraduationCap, ExternalLink, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Cổng thông tin CDC',
    robots: { index: false, follow: false },
}

const apps = [
    {
        title: 'CDC LIMS',
        description: 'Hệ thống quản lý thông tin xét nghiệm',
        icon: FlaskConical,
        href: '/login',
        color: 'from-blue-500 to-indigo-600',
        glowColor: 'group-hover:shadow-blue-500/25',
        iconColor: 'text-blue-50',
        external: false,
    },
    {
        title: 'CVMEMS',
        description: 'Hệ thống quản lý trang thiết bị y tế',
        icon: Activity,
        href: 'https://www.cvmems.vn',
        color: 'from-emerald-500 to-teal-600',
        glowColor: 'group-hover:shadow-emerald-500/25',
        iconColor: 'text-emerald-50',
        external: true,
    },
    {
        title: 'Quản lý TBYT CDC',
        description: 'Quản lý thiết bị y tế CDC',
        icon: Package,
        href: 'https://quan-ly-tbyt.pages.dev/',
        color: 'from-amber-500 to-orange-600',
        glowColor: 'group-hover:shadow-amber-500/25',
        iconColor: 'text-amber-50',
        external: true,
    },
    {
        title: 'Đào tạo nhân lực y tế',
        description: 'Hệ thống quản lý đào tạo nhân lực ngành y tế',
        icon: GraduationCap,
        href: 'https://daotaoytct.vn',
        color: 'from-purple-500 to-violet-600',
        glowColor: 'group-hover:shadow-purple-500/25',
        iconColor: 'text-purple-50',
        external: true,
    },
] as const

export default function PortalPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-blue-50/80 to-transparent dark:from-blue-950/30" />
                <div className="absolute top-[-120px] right-[-120px] w-[500px] h-[500px] bg-blue-200/25 dark:bg-blue-900/15 rounded-full blur-3xl" />
                <div className="absolute top-[180px] left-[-80px] w-[350px] h-[350px] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-3xl" />
                <div className="absolute bottom-[-100px] right-[20%] w-[400px] h-[400px] bg-emerald-200/15 dark:bg-emerald-900/10 rounded-full blur-3xl" />
            </div>

            {/* Content */}
            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
                {/* Header */}
                <div className="text-center mb-10 opacity-0 animate-fade-in-up">
                    <div className="flex justify-center mb-5">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full blur-xl opacity-20 scale-150" />
                            <Image
                                src="/cdc-logo-400x400.png"
                                alt="CDC Logo"
                                width={88}
                                height={88}
                                className="relative w-22 h-22 object-contain drop-shadow-md"
                                priority
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
                        Cổng thông tin{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                            CDC
                        </span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg max-w-md mx-auto leading-relaxed">
                        Trung tâm Kiểm soát Bệnh tật tỉnh Cà Mau
                    </p>
                </div>

                {/* App Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                    {apps.map((app, index) => {
                        const CardWrapper = app.external ? 'a' : Link
                        const externalProps = app.external
                            ? { target: '_blank' as const, rel: 'noopener noreferrer' }
                            : {}

                        return (
                            <CardWrapper
                                key={app.href}
                                href={app.href}
                                {...externalProps}
                                className={`group relative cursor-pointer opacity-0 animate-fade-in-up animate-delay-${(index + 1) * 100}`}
                            >
                                <div className={`h-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/50 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl ${app.glowColor} hover:border-slate-300/80 dark:hover:border-slate-700/80 hover:-translate-y-1 overflow-hidden`}>
                                    {/* Hover gradient overlay */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${app.color} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500 rounded-2xl`} />

                                    <div className="relative z-10 flex flex-col h-full">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${app.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                                <app.icon className={`h-5 w-5 ${app.iconColor}`} strokeWidth={2.5} />
                                            </div>
                                            {app.external && (
                                                <ExternalLink className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                                                {app.title}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                                {app.description}
                                            </p>
                                        </div>

                                        {/* Arrow indicator on hover */}
                                        <div className="absolute bottom-4 right-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <ArrowRight className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                        </div>
                                    </div>
                                </div>
                            </CardWrapper>
                        )
                    })}
                </div>

                {/* Footer */}
                <div className="mt-10 text-center opacity-0 animate-fade-in-up animate-delay-500">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        &copy; {new Date().getFullYear()} Khoa Xét nghiệm &mdash; Trung tâm Kiểm soát Bệnh tật tỉnh Cà Mau
                    </p>
                </div>
            </div>
        </div>
    )
}
