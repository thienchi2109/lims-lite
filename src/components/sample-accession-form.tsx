'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateSampleWithAssignmentsSchema, type CreateSampleWithAssignments } from '@/types'
import { accessionAndAssignTests } from '@/app/actions/samples'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QRScanner } from '@/components/qr-scanner'
import { TestAssignmentSelector, type SelectedTest } from '@/components/test-assignment-selector'
import { Loader2, CheckCircle2, Scan } from 'lucide-react'

export function SampleAccessionForm() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
    const [showScanner, setShowScanner] = useState(false)
    const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([])

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
    } = useForm<CreateSampleWithAssignments>({
        resolver: zodResolver(CreateSampleWithAssignmentsSchema),
        defaultValues: {
            client_name: '',
            received_at: undefined,
            tests: [],
        },
    })

    // Keep form value in sync with POS-style selector
    useEffect(() => {
        setValue(
            'tests',
            selectedTests.map((t) => ({
                assayId: t.assayId,
                methodId: t.methodId,
            })),
            { shouldValidate: true }
        )
    }, [selectedTests, setValue])

    const onSubmit = async (data: CreateSampleWithAssignments) => {
        setIsSubmitting(true)
        setSubmitError(null)
        setSubmitSuccess(null)

        const result = await accessionAndAssignTests(data)

        if (result.error) {
            setSubmitError(result.error)
        } else {
            const sampleCode = result.data?.sample?.sample_id
            const assignedCount = result.data?.results?.length || data.tests.length
            setSubmitSuccess(`Mẫu ${sampleCode || ''} đã được tạo và chỉ định ${assignedCount} xét nghiệm.`.trim())
            reset()
            setSelectedTests([])
            // Clear success message after 5 seconds
            setTimeout(() => setSubmitSuccess(null), 5000)
        }

        setIsSubmitting(false)
    }

    const handleQRScan = (decodedText: string) => {
        setValue('client_name', decodedText)
        setShowScanner(false)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tiếp nhận mẫu mới</CardTitle>
                <CardDescription>
                    Tiếp nhận mẫu mới và chỉ định xét nghiệm. Mã mẫu sẽ được tạo tự động.
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

                    {/* Test Assignment Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Chỉ định xét nghiệm *</Label>
                            <span className="text-xs text-muted-foreground">
                                Chọn ít nhất một chỉ tiêu và phương pháp
                            </span>
                        </div>

                        <TestAssignmentSelector
                            selected={selectedTests}
                            onChange={setSelectedTests}
                            heading="Chọn xét nghiệm (POS)"
                            subheading="Tìm kiếm chỉ tiêu, chọn phương pháp và thêm vào danh sách"
                        />

                        {errors.tests && (
                            <p className="text-sm text-destructive">
                                {(errors.tests?.message as string) || 'Vui lòng chọn ít nhất một xét nghiệm'}
                            </p>
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
                            'Tạo mẫu và chỉ định'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
