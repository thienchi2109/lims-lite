'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateSampleSchema, type CreateSample } from '@/types'
import { createSample } from '@/app/actions/samples'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QRScanner } from '@/components/qr-scanner'
import { Loader2, CheckCircle2, Scan } from 'lucide-react'

export function SampleAccessionForm() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
    const [showScanner, setShowScanner] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
    } = useForm<CreateSample>({
        resolver: zodResolver(CreateSampleSchema),
        defaultValues: {
            client_name: '',
        },
    })

    const onSubmit = async (data: CreateSample) => {
        setIsSubmitting(true)
        setSubmitError(null)
        setSubmitSuccess(null)

        const result = await createSample(data)

        if (result.error) {
            setSubmitError(result.error)
        } else {
            setSubmitSuccess(`Mẫu ${result.data?.sample_id} đã được tạo thành công!`)
            reset()
            // Clear success message after 5 seconds
            setTimeout(() => setSubmitSuccess(null), 5000)
        }

        setIsSubmitting(false)
    }

    const handleQRScan = (decodedText: string) => {
        // Assuming QR code contains client name or sample info
        // You can customize this based on your QR code format
        setValue('client_name', decodedText)
        setShowScanner(false)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tiếp nhận mẫu mới</CardTitle>
                <CardDescription>
                    Tiếp nhận mẫu mới vào hệ thống. Mã mẫu sẽ được tạo tự động.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Client Name Field */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="client_name">Tên khách hàng *</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowScanner(!showScanner)}
                            >
                                <Scan className="h-4 w-4 mr-2" />
                                {showScanner ? 'Ẩn máy quét' : 'Quét QR'}
                            </Button>
                        </div>
                        <Input
                            id="client_name"
                            {...register('client_name')}
                            placeholder="Nhập tên khách hàng"
                            autoFocus
                        />
                        {errors.client_name && (
                            <p className="text-sm text-destructive">{errors.client_name.message}</p>
                        )}
                    </div>

                    {/* QR Scanner */}
                    {showScanner && (
                        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                            <QRScanner
                                onScan={handleQRScan}
                                onError={(error) => setSubmitError(error)}
                            />
                        </div>
                    )}

                    {/* Received At Field (Optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="received_at">Thời gian nhận (Tùy chọn)</Label>
                        <Input
                            id="received_at"
                            type="datetime-local"
                            {...register('received_at')}
                        />
                        <p className="text-xs text-muted-foreground">
                            Để trống để sử dụng ngày giờ hiện tại
                        </p>
                        {errors.received_at && (
                            <p className="text-sm text-destructive">{errors.received_at.message}</p>
                        )}
                    </div>

                    {/* Error Message */}
                    {submitError && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                            {submitError}
                        </div>
                    )}

                    {/* Success Message */}
                    {submitSuccess && (
                        <div className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 p-3 rounded-md text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            {submitSuccess}
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang tạo mẫu...
                            </>
                        ) : (
                            'Tạo mẫu'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
