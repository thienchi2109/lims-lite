'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, FileText, XCircle, AlertCircle, LogOut, Phone, Search, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CoAPreviewDialog } from '@/components/coa-preview-dialog'
import { CoAAccessSampleCard } from '@/components/coa-access-sample-card'
import type { CoAAuthResponse, CoASampleInfo } from '@/types'

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const CoAAccessFormSchema = z.object({
    phone: z.string()
        .min(10, 'Số điện thoại không hợp lệ')
        .max(15, 'Số điện thoại không hợp lệ')
        .regex(/^(0|\+?84)[0-9]{9,10}$/, 'Số điện thoại không đúng định dạng'),
})

type CoAAccessFormData = z.infer<typeof CoAAccessFormSchema>

// ============================================================================
// COMPONENT
// ============================================================================

export function CoAAccessForm() {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [authResponse, setAuthResponse] = useState<CoAAuthResponse | null>(null)
    const [previewSample, setPreviewSample] = useState<{
        sampleId: string
        sampleIdDisplay: string
    } | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<CoAAccessFormData>({
        resolver: zodResolver(CoAAccessFormSchema),
        defaultValues: {
            phone: '',
        },
    })

    // ========================================================================
    // AUTHENTICATION HANDLER
    // ========================================================================

    const onSubmit = async (data: CoAAccessFormData) => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/coa/authenticate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })

            const result: CoAAuthResponse = await response.json()

            if (!response.ok || !result.success) {
                // Generic error message
                setError(result.error || 'Không tìm thấy thông tin khách hàng')
                setAuthResponse(null)
                return
            }

            // Success - show samples
            setAuthResponse(result)
            setError(null)
        } catch (err) {
            console.error('Auth error:', err)
            setError('Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.')
        } finally {
            setIsLoading(false)
        }
    }

    // ========================================================================
    // PREVIEW HANDLERS
    // ========================================================================

    const handlePreviewOpen = (sampleId: string, sampleIdDisplay: string) => {
        setPreviewSample({ sampleId, sampleIdDisplay })
    }

    const handlePreviewOpenChange = (open: boolean) => {
        if (!open) {
            setPreviewSample(null)
        }
    }

    const handleLogout = () => {
        void fetch('/api/coa/logout', { method: 'POST' })
        setPreviewSample(null)
        setAuthResponse(null)
        setError(null)
        reset()
    }

    const handleUnauthorizedPreviewRecovery = () => {
        handleLogout()
    }

    // ========================================================================
    // RENDER: AUTHENTICATED VIEW (Samples List)
    // ========================================================================

    if (authResponse && authResponse.success) {
        return (
            <>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50 ring-1 ring-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 shrink-0 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                                {(authResponse.client_name || 'K').charAt(0).toUpperCase()}
                            </div>
                            <h2 className="text-base font-bold text-slate-800">
                                {authResponse.client_name || 'Khách hàng'}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 pl-10">
                            Tìm thấy <strong className="text-blue-600">{authResponse.samples?.length || 0}</strong> mẫu xét nghiệm
                        </p>
                    </div>
                    <Button
                        onClick={handleLogout}
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-9 px-3 rounded-full"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Thoát
                    </Button>
                </div>

                {/* Samples List - Scrollable */}
                <ScrollArea className="h-[450px] w-full bg-slate-50/30">
                    <div className="p-6">
                        {authResponse.samples && authResponse.samples.length > 0 ? (
                            <div className="space-y-4">
                                {authResponse.samples.map((sample: CoASampleInfo) => (
                                    <CoAAccessSampleCard
                                        key={sample.id}
                                        sample={sample}
                                        onPreview={handlePreviewOpen}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <Search className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-slate-900 font-medium mb-1">Không tìm thấy kết quả</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                    Hiện chưa có kết quả xét nghiệm nào hoàn thành cho số điện thoại này.
                                </p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                </div>

                <CoAPreviewDialog
                    open={Boolean(previewSample)}
                    onOpenChange={handlePreviewOpenChange}
                    sampleId={previewSample?.sampleId ?? ''}
                    title="Phiếu Kết Quả Phân Tích"
                    subtitle={
                        previewSample ? `Mã số mẫu: ${previewSample.sampleIdDisplay}` : undefined
                    }
                    route="client"
                    onUnauthorized={handleUnauthorizedPreviewRecovery}
                />
            </>
        )
    }

    // ========================================================================
    // RENDER: LOGIN FORM
    // ========================================================================

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50 ring-1 ring-slate-100">
            {/* Form Header */}
            <div className="bg-slate-50/50 px-6 py-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-xl font-bold text-slate-900">
                            Đăng Nhập
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Nhập số điện thoại để tra cứu
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200 animate-in fade-in slide-in-from-top-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-900 font-medium">{error}</AlertDescription>
                    </Alert>
                )}

                {/* Phone Number Field */}
                <div className="space-y-2.5 text-left">
                    <Label htmlFor="phone" className="text-slate-700 font-semibold text-sm ml-1">
                        Số điện thoại đăng ký <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                        <Input
                            id="phone"
                            type="tel"
                            placeholder="Ví dụ: 0987654321"
                            {...register('phone')}
                            disabled={isLoading}
                            className={`h-12 pl-4 text-lg tracking-wide transition-all duration-200 ${errors.phone
                                ? 'border-red-300 focus-visible:ring-red-200 bg-red-50/30'
                                : 'border-slate-200 hover:border-blue-300 focus-visible:ring-blue-100 focus-visible:border-blue-500'
                                }`}
                        />
                        {/* Icon indicator inside input could go here if needed */}
                    </div>
                    {errors.phone ? (
                        <p className="text-sm text-red-600 flex items-center gap-1.5 font-medium ml-1 animate-in slide-in-from-left-1">
                            <XCircle className="w-3.5 h-3.5" />
                            {errors.phone.message}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-500 ml-1">
                            Nhập chính xác số điện thoại bạn đã cung cấp khi gửi mẫu.
                        </p>
                    )}
                </div>

                {/* Submit Button */}
                <Button
                    type="submit"
                    className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold shadow-lg shadow-blue-500/25 rounded-lg transition-all active:scale-[0.98]"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Đang xử lý...
                        </>
                    ) : (
                        <>
                            <Search className="mr-2 h-5 w-5" />
                            Tra Cứu Ngay
                        </>
                    )}
                </Button>
            </form>

            {/* Security Footer */}
            <div className="py-4 bg-slate-50 border-t border-slate-100 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Được bảo mật bởi CDC LIMS
                </div>
            </div>
        </div>
    )
}
