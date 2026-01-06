/**
 * CoA Access Form Component
 *
 * Phase 6: Frontend - Public Portal
 *
 * Form for clients to authenticate using phone number only (simplified auth)
 * Displays list of approved samples with download links on success
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, FileText, CheckCircle, XCircle, AlertCircle, LogOut, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                Xin chào, {authResponse.client_name}
                            </h2>
                            <p className="text-sm text-slate-500">
                                Danh sách mẫu xét nghiệm của bạn
                            </p>
                        </div>
                        <Button
                            onClick={handleLogout}
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Đăng xuất
                        </Button>
                    </div>
                </div>

                {/* Samples List */}
                <div className="p-6">
                    {authResponse.samples && authResponse.samples.length > 0 ? (
                        <div className="space-y-3">
                            {authResponse.samples.map((sample: CoASampleInfo) => (
                                <SampleCard
                                    key={sample.id}
                                    sample={sample}
                                    onDownload={handleDownload}
                                />
                            ))}
                        </div>
                    ) : (
                        <Alert className="border-cyan-200 bg-cyan-50">
                            <AlertCircle className="h-4 w-4 text-cyan-600" />
                            <AlertDescription className="text-cyan-900">
                                Chưa có mẫu xét nghiệm nào hoàn thành.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>
        )
    }

    // ========================================================================
    // RENDER: LOGIN FORM
    // ========================================================================

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Form Header */}
            <div className="bg-white px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            Đăng Nhập
                        </h2>
                        <p className="text-sm text-slate-500">
                            Nhập số điện thoại để truy cập
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-900">{error}</AlertDescription>
                    </Alert>
                )}

                {/* Phone Number Field */}
                <div className="space-y-2">
                    <Label htmlFor="phone" className="text-slate-900 font-medium">
                        Số điện thoại <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="phone"
                        type="tel"
                        placeholder="0987654321 hoặc +84987654321"
                        {...register('phone')}
                        disabled={isLoading}
                        className={`h-11 ${errors.phone ? 'border-red-500 focus-visible:ring-red-500' : 'border-slate-300 focus-visible:ring-cyan-500'}`}
                    />
                    {errors.phone && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            {errors.phone.message}
                        </p>
                    )}
                    <p className="text-xs text-slate-500">
                        Sử dụng số điện thoại bạn đã cung cấp khi gửi mẫu
                    </p>
                </div>

                {/* Submit Button */}
                <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-sm"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang xử lý...
                        </>
                    ) : (
                        <>
                            <Phone className="mr-2 h-4 w-4" />
                            Truy cập kết quả
                        </>
                    )}
                </Button>

                {/* Help Text */}
                <div className="pt-2 text-center">
                    <p className="text-xs text-slate-500">
                        Bằng cách đăng nhập, bạn đồng ý với việc xử lý dữ liệu cá nhân theo quy định
                    </p>
                </div>
            </form>
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
        }).format(date)
    }

    return (
        <div className="border border-slate-200 rounded-lg p-4 hover:border-cyan-300 hover:shadow-md transition-all cursor-pointer bg-white group">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0 w-full">
                    {/* Sample ID */}
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-3">
                        <h3 className="font-semibold text-slate-900 text-lg">
                            {sample.sample_id_display}
                        </h3>
                        {sample.has_coa ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-green-50 border border-green-200 rounded-full">
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                <span className="text-xs font-bold text-green-700">Sẵn sàng</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 border border-amber-200 rounded-full">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-amber-700">Đang xử lý</span>
                            </div>
                        )}
                    </div>

                    {/* Sample Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-500 w-full mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Loại mẫu</span>
                            <span className="font-semibold text-slate-800 text-base">{sample.sample_type || 'N/A'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Ngày nhận</span>
                            <span className="font-semibold text-slate-800 text-base">{formatDate(sample.received_date)}</span>
                        </div>
                    </div>
                </div>

                {/* Download Button - Full width on mobile, auto on desktop */}
                <div className="w-full sm:w-auto mt-2 sm:mt-0">
                    {sample.has_coa ? (
                        <Button
                            onClick={(e) => {
                                e.stopPropagation()
                                onDownload(sample.id, sample.sample_id_display)
                            }}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-95"
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            Xem Kết Quả
                        </Button>
                    ) : (
                        <div className="w-full sm:w-auto text-xs text-center text-amber-700 bg-amber-50 px-3 py-2.5 rounded-md border border-amber-200">
                            Chưa có kết quả
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
