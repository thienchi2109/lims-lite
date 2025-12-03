'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateSampleWithAssignmentsSchema, type CreateSampleWithAssignments } from '@/types'
import { accessionAndAssignTests } from '@/app/actions/samples'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QRScanner } from '@/components/qr-scanner'
import { TestAssignmentGrid, type SelectedTest } from '@/components/test-assignment-grid'
import { Loader2, CheckCircle2, Scan } from 'lucide-react'

export function SampleAccessionForm() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
    const [showScanner, setShowScanner] = useState(false)
    const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([])

    // Form schema that accepts datetime-local string format
    // We relax validation here and validate manually before submit
    const FormSchema = z.object({
        client_name: z.string().min(1, 'Tên khách hàng là bắt buộc'),
        received_at: z.string().optional(),
        tests: z.array(z.object({
            assayId: z.string(),
            methodId: z.string(),
        })).optional(),
    })

    type FormData = z.infer<typeof FormSchema>

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
    } = useForm<FormData>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            client_name: '',
            received_at: '',
            tests: [],
        },
    })

    // Keep form value in sync with grid selector
    useEffect(() => {
        setValue(
            'tests',
            selectedTests.map((t) => ({
                assayId: t.assayId,
                methodId: t.methodId,
            })),
            { shouldValidate: false } // Don't trigger validation on every change
        )
    }, [selectedTests, setValue])

    const onSubmit = async (data: FormData) => {
        // Manual validation for tests
        if (selectedTests.length === 0) {
            setSubmitError('Vui lòng chọn ít nhất một xét nghiệm')
            return
        }

        setIsSubmitting(true)
        setSubmitError(null)
        setSubmitSuccess(null)

        try {
            // Convert datetime-local string to ISO format for the API
            const payload: CreateSampleWithAssignments = {
                client_name: data.client_name,
                received_at: data.received_at ? new Date(data.received_at).toISOString() : undefined,
                tests: selectedTests.map((t) => ({
                    assayId: t.assayId,
                    methodId: t.methodId,
                })),
            }

            const result = await accessionAndAssignTests(payload)

            if (result.error) {
                setSubmitError(result.error)
            } else {
                const sampleCode = result.data?.sample?.sample_id
                const assignedCount = result.data?.results?.length || selectedTests.length
                setSubmitSuccess(`Mẫu ${sampleCode || ''} đã được tạo và chỉ định ${assignedCount} xét nghiệm.`.trim())
                reset()
                setSelectedTests([])
                // Clear success message after 5 seconds
                setTimeout(() => setSubmitSuccess(null), 5000)
            }
        } catch (error) {
            setSubmitError('Đã có lỗi xảy ra')
        }

        setIsSubmitting(false)
    }

    const handleQRScan = (decodedText: string) => {
        setValue('client_name', decodedText)
        setShowScanner(false)
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="h-full">
            <TestAssignmentGrid
                selected={selectedTests}
                onChange={setSelectedTests}
                isSaving={isSubmitting}
                onSave={handleSubmit(onSubmit)}
                saveLabel="Tạo mẫu và chỉ định"
                context={
                    <div className="space-y-6">
                        {/* Client Name Field */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="client_name">Tên khách hàng *</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowScanner(!showScanner)}
                                    className="h-6 px-2 text-xs"
                                >
                                    <Scan className="h-3 w-3 mr-1" />
                                    {showScanner ? 'Ẩn' : 'Quét QR'}
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
                            <div className="border rounded-lg p-2 bg-slate-50 dark:bg-slate-900">
                                <QRScanner
                                    onScan={handleQRScan}
                                    onError={(error) => setSubmitError(error)}
                                />
                            </div>
                        )}

                        {/* Received At Field (Optional) */}
                        <div className="space-y-2">
                            <Label htmlFor="received_at">Thời gian nhận</Label>
                            <Input
                                id="received_at"
                                type="datetime-local"
                                {...register('received_at')}
                            />
                            <p className="text-xs text-muted-foreground">
                                Tùy chọn. Mặc định là hiện tại.
                            </p>
                            {errors.received_at && (
                                <p className="text-sm text-destructive">{errors.received_at.message}</p>
                            )}
                        </div>

                        {/* Validation Error for Tests - shown only when trying to submit */}
                        {/* Error is now handled in onSubmit and shown in submitError */}

                        {/* Submit Error */}
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
                    </div>
                }
            />
        </form>
    )
}
