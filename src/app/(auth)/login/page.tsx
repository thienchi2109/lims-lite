'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import { Lock, User, Loader2, AlertCircle } from 'lucide-react'

type FormState = {
    error?: {
        username?: string[]
        password?: string[]
        general?: string[]
    }
} | null

export default function LoginPage() {
    const [state, formAction, isPending] = useActionState<FormState, FormData>(login, null)

    return (
        <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2">
            {/* Left Column - Hero Image & Branding */}
            <div className="hidden lg:flex flex-col relative overflow-hidden bg-slate-900">
                <Image
                    src="/2305.i039.008.F.m004.c9.biotechnology isometric.jpg"
                    alt="Mô hình phòng xét nghiệm hiện đại"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent" />
                
                <div className="relative z-10 mt-auto p-12 text-center space-y-4">
                    <h2 className="text-3xl font-bold tracking-tight text-white whitespace-nowrap">
                        Hệ thống Quản lý thông tin Xét nghiệm
                    </h2>
                    <p className="text-slate-200 text-lg leading-relaxed max-w-lg mx-auto">
                        Nền tảng quản lý xét nghiệm hiện đại, chính xác và bảo mật dành cho Trung tâm Kiểm soát Bệnh tật.
                    </p>
                </div>
            </div>

            {/* Right Column - Login Form */}
            <div className="flex items-center justify-center p-8 lg:p-24 bg-white dark:bg-slate-950">
                <div className="w-full max-w-[400px] space-y-8 animate-in slide-in-from-right-8 duration-700">
                    {/* Header */}
                    <div className="space-y-6 flex flex-col items-center text-center">
                        <div className="flex flex-col items-center gap-4">
                            <Image 
                                src="/cdc-logo-400x400.png" 
                                alt="CDC Logo" 
                                width={80} 
                                height={80} 
                                className="w-20 h-20 object-contain drop-shadow-sm" 
                            />
                            <div className="flex flex-col items-center">
                                <span className="font-bold text-xl leading-none text-slate-900 dark:text-slate-100">CDC LIMS</span>
                                <span className="text-sm text-slate-500 font-medium mt-1">Secure Access</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                                Chào mừng trở lại
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400">
                                Vui lòng nhập thông tin đăng nhập để tiếp tục.
                            </p>
                        </div>
                    </div>

                    {/* Form */}
                    <form action={formAction} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="username">Tên đăng nhập</Label>
                            <div className="relative group">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                <Input
                                    id="username"
                                    name="username"
                                    type="text"
                                    placeholder="user@example.com"
                                    required
                                    disabled={isPending}
                                    className="pl-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 transition-all duration-200 bg-slate-50/50 dark:bg-slate-900/50"
                                    aria-invalid={!!state?.error?.username}
                                    aria-describedby={state?.error?.username ? "username-error" : undefined}
                                />
                            </div>
                            {state?.error?.username && (
                                <p id="username-error" className="text-sm text-destructive flex items-center gap-1 mt-1 animate-in slide-in-from-top-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {state.error.username[0]}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Mật khẩu</Label>
                                {/* Forgot password link could go here in future */}
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    disabled={isPending}
                                    className="pl-10 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 transition-all duration-200 bg-slate-50/50 dark:bg-slate-900/50"
                                    aria-invalid={!!state?.error?.password}
                                    aria-describedby={state?.error?.password ? "password-error" : undefined}
                                />
                            </div>
                            {state?.error?.password && (
                                <p id="password-error" className="text-sm text-destructive flex items-center gap-1 mt-1 animate-in slide-in-from-top-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {state.error.password[0]}
                                </p>
                            )}
                        </div>

                        {state?.error?.general && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2 border border-destructive/20 animate-in zoom-in-95">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <p>{state.error.general[0]}</p>
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all duration-200 h-11 text-base font-medium" 
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang xác thực...
                                </>
                            ) : (
                                'Đăng nhập'
                            )}
                        </Button>
                    </form>

                    {/* Footer */}
                    <div className="space-y-4">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">
                                    Khu vực hạn chế
                                </span>
                            </div>
                        </div>
                        <p className="text-center text-xs text-slate-400">
                            &copy; {new Date().getFullYear()} Khoa Xét nghiệm - CDC.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}