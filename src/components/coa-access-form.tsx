'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, FileText, CheckCircle, XCircle, AlertCircle, LogOut, Phone, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    // DOWNLOAD HANDLER
    // ========================================================================

    const handleDownload = (sampleId: string, sampleIdDisplay: string) => {
        const downloadUrl = `/api/coa/download?sample_id=${sampleId}`

        // Open in new tab (signed URL will redirect to file)
        const newTab = window.open(downloadUrl, '_blank', 'noopener')
        if (!newTab) {
            setError('Trình duyệt đã chặn cửa sổ mới. Vui lòng cho phép popup và thử lại.')
        }
    }

    // ========================================================================
    // LOGOUT HANDLER
    // ========================================================================

    const handleLogout = () => {
        void fetch('/api/coa/logout', { method: 'POST' })
        setAuthResponse(null)
        setError(null)
        reset()
    }

    // ========================================================================
    // RENDER: AUTHENTICATED VIEW (Samples List)
    // ========================================================================

    if (authResponse && authResponse.success) {
        return (
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
                                    <SampleCard
                                        key={sample.id}
                                        sample={sample}
                                        onDownload={handleDownload}
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

// ============================================================================
// SAMPLE CARD COMPONENT
// ============================================================================

interface SampleCardProps {
    sample: CoASampleInfo
    onDownload: (sampleId: string, sampleIdDisplay: string) => void
}

function SampleCard({ sample, onDownload }: SampleCardProps) {
    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A'
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date)
    }

    return (
        <div className="group relative bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 cursor-default">

            {/* Status Indicator Bar */}
            <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-colors ${sample.has_coa ? 'bg-green-500' : 'bg-amber-400'}`} />

            <div className="flex flex-col gap-4 pl-3">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-900 text-lg tracking-tight">
                                {sample.sample_id_display}
                            </h3>
                            {sample.has_coa ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold uppercase border border-green-200">
                                    <CheckCircle className="w-3 h-3" /> Hoàn thành
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase border border-amber-200">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Đang xử lý
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-600 font-medium">
                            {sample.sample_type || 'Mẫu xét nghiệm'}
                        </p>
                    </div>

                    {/* Action Button for Desktop (hidden on mobile, shown in separate row) */}
                    <div className="hidden sm:block">
                        {sample.has_coa && (
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDownload(sample.id, sample.sample_id_display)
                                }}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm hover:shadow-blue-200 transition-all"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Tải Kết Quả
                            </Button>
                        )}
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-100">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Ngày nhận mẫu</span>
                        <div className="text-sm font-semibold text-slate-700">
                            {formatDate(sample.received_date)}
                        </div>
                    </div>
                    <div>
                        {sample.has_coa && (
                            <>
                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Mã hồ sơ</span>
                                <div className="text-sm font-semibold text-slate-700 truncate" title={sample.id}>
                                    #{sample.id.slice(0, 8)}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Mobile Action Button */}
                <div className="sm:hidden mt-2">
                    {sample.has_coa ? (
                        <Button
                            onClick={(e) => {
                                e.stopPropagation()
                                onDownload(sample.id, sample.sample_id_display)
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Tải Kết Quả
                        </Button>
                    ) : (
                        <div className="w-full text-center text-xs text-amber-600 font-medium bg-amber-50 py-2 rounded border border-amber-100">
                            Kết quả đang được xử lý
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
