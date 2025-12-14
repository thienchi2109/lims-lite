/**
 * CoA Access Form Component
 *
 * Phase 6: Frontend - Public Portal
 *
 * Form for clients to authenticate using phone + passcode (last 6 digits)
 * Displays list of approved samples with download links on success
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
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
    passcode: z.string()
        .length(6, 'Mật khẩu phải có 6 chữ số')
        .regex(/^[0-9]{6}$/, 'Mật khẩu chỉ chứa chữ số'),
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
            passcode: '',
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
                // Generic error message - don't reveal if phone exists
                setError(result.error || 'Không tìm thấy mẫu hoặc mật khẩu không đúng')
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
        if (!authResponse?.token) {
            setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
            return
        }

        const downloadUrl = `/api/coa/download?sample_id=${sampleId}&token=${authResponse.token}`

        // Open in new tab (signed URL will redirect to file)
        window.open(downloadUrl, '_blank')
    }

    // ========================================================================
    // LOGOUT HANDLER
    // ========================================================================

    const handleLogout = () => {
        setAuthResponse(null)
        setError(null)
        reset()
    }

    // ========================================================================
    // RENDER: AUTHENTICATED VIEW (Samples List)
    // ========================================================================

    if (authResponse && authResponse.success) {
        return (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                            Xin chào, {authResponse.client_name}
                        </h2>
                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            size="sm"
                        >
                            Đăng xuất
                        </Button>
                    </div>
                    <p className="text-sm text-gray-600">
                        Danh sách mẫu xét nghiệm đã hoàn thành
                    </p>
                </div>

                {/* Samples List */}
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
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Chưa có mẫu xét nghiệm nào hoàn thành.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        )
    }

    // ========================================================================
    // RENDER: LOGIN FORM
    // ========================================================================

    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Phone Number Field */}
                <div className="space-y-2">
                    <Label htmlFor="phone">
                        Số điện thoại <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="phone"
                        type="tel"
                        placeholder="0987654321 hoặc +84987654321"
                        {...register('phone')}
                        disabled={isLoading}
                        className={errors.phone ? 'border-red-500' : ''}
                    />
                    {errors.phone && (
                        <p className="text-sm text-red-600">{errors.phone.message}</p>
                    )}
                </div>

                {/* Passcode Field */}
                <div className="space-y-2">
                    <Label htmlFor="passcode">
                        Mật khẩu (6 chữ số cuối SĐT) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="passcode"
                        type="password"
                        placeholder="••••••"
                        maxLength={6}
                        inputMode="numeric"
                        {...register('passcode')}
                        disabled={isLoading}
                        className={errors.passcode ? 'border-red-500' : ''}
                    />
                    {errors.passcode && (
                        <p className="text-sm text-red-600">{errors.passcode.message}</p>
                    )}
                    <p className="text-xs text-gray-500">
                        Ví dụ: Nếu SĐT là 0987654321, mật khẩu là 654321
                    </p>
                </div>

                {/* Submit Button */}
                <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang xử lý...
                        </>
                    ) : (
                        'Truy cập'
                    )}
                </Button>
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
        <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                            {sample.sample_id_display}
                        </h3>
                        {sample.has_coa ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                        )}
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <dt className="text-gray-500">Loại mẫu:</dt>
                            <dd className="font-medium text-gray-900">
                                {sample.sample_type || 'N/A'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-gray-500">Ngày nhận:</dt>
                            <dd className="font-medium text-gray-900">
                                {formatDate(sample.received_date)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-gray-500">Ngày duyệt:</dt>
                            <dd className="font-medium text-gray-900">
                                {formatDate(sample.approved_at)}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Download Button */}
                <div className="ml-4">
                    {sample.has_coa ? (
                        <Button
                            onClick={() => onDownload(sample.id, sample.sample_id_display)}
                            size="sm"
                            className="whitespace-nowrap"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Tải về
                        </Button>
                    ) : (
                        <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
                            Giấy chứng nhận<br />chưa sẵn sàng
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
