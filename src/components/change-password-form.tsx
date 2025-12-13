'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChangePassword, ChangePasswordSchema } from '@/types'
import { updatePassword } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Lock, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useFormState } from 'react-dom'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function ChangePasswordForm() {
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    const form = useForm<ChangePassword>({
        resolver: zodResolver(ChangePasswordSchema),
        defaultValues: {
            currentPassword: '',
            password: '',
            confirmPassword: '',
        },
    })

    const onSubmit = async (data: ChangePassword) => {
        setIsPending(true)
        const formData = new FormData()
        formData.append('currentPassword', data.currentPassword)
        formData.append('password', data.password)
        formData.append('confirmPassword', data.confirmPassword)

        try {
            const result = await updatePassword(null, formData)

            if (result?.error) {
                const errorObj = result.error as { general?: string[];[key: string]: string[] | undefined }
                if (errorObj.general) {
                    toast.error(errorObj.general[0])
                } else {
                    // Start manually setting field errors
                    // The error object might be flattened field errors
                    Object.entries(result.error).forEach(([key, messages]) => {
                        if (key !== 'general' && Array.isArray(messages)) {
                            form.setError(key as keyof ChangePassword, {
                                type: 'server',
                                message: messages[0]
                            })
                        }
                    })
                }
            } else if (result?.success) {
                toast.success('Đổi mật khẩu thành công!')
                form.reset()
                router.refresh()
            }
        } catch (error) {
            toast.error('Đã có lỗi xảy ra. Vui lòng thử lại.')
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/20 dark:shadow-black/20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md h-full">
            <CardHeader className="space-y-1 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Bảo mật</span>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                    Đổi mật khẩu
                </CardTitle>
                <CardDescription>
                    Cập nhật mật khẩu mới để bảo vệ tài khoản của bạn.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="currentPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-slate-700 dark:text-slate-300">Mật khẩu hiện tại</FormLabel>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <FormControl>
                                            <Input
                                                type={showCurrentPassword ? 'text' : 'password'}
                                                className="pl-9 pr-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="Nhập mật khẩu hiện tại..."
                                                disabled={isPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            disabled={isPending}
                                        >
                                            {showCurrentPassword ? (
                                                <EyeOff className="h-4 w-4 text-slate-400" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-slate-400" />
                                            )}
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-slate-700 dark:text-slate-300">Mật khẩu mới</FormLabel>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <FormControl>
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                className="pl-9 pr-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="Nhập mật khẩu mới..."
                                                disabled={isPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowPassword(!showPassword)}
                                            disabled={isPending}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4 text-slate-400" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-slate-400" />
                                            )}
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-slate-700 dark:text-slate-300">Xác nhận mật khẩu</FormLabel>
                                    <div className="relative">
                                        <CheckCircle2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <FormControl>
                                            <Input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                className="pl-9 pr-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="Nhập lại mật khẩu..."
                                                disabled={isPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            disabled={isPending}
                                        >
                                            {showConfirmPassword ? (
                                                <EyeOff className="h-4 w-4 text-slate-400" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-slate-400" />
                                            )}
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="pt-2">
                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all"
                                disabled={isPending}
                            >
                                {isPending ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs mr-2"></span>
                                        Đang cập nhật...
                                    </>
                                ) : (
                                    'Cập nhật mật khẩu'
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
