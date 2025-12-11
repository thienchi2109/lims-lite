'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateSampleWithAssignmentsSchema, type CreateSampleWithAssignments, type CreateSample, type Client, type SampleType } from '@/types'
import { accessionAndAssignTestsClient, createSampleClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TestAssignmentGrid, type SelectedTest } from '@/components/test-assignment-grid'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { ClientSelector } from '@/components/client-selector'
import { SampleTypeSelector } from '@/components/sample-type-selector'

export function SampleAccessionForm() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
    const [lastSampleId, setLastSampleId] = useState<string | null>(null)
    const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([])
    const [showConfirmation, setShowConfirmation] = useState(false)

    // New state for Client and Sample Type
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [selectedSampleType, setSelectedSampleType] = useState<SampleType>('Máu')

    // Form schema that accepts datetime-local string format
    // We relax validation here and validate manually before submit
    const FormSchema = z.object({
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
        // Validate Client Selection
        if (!selectedClient) {
            setSubmitError('Vui lòng chọn khách hàng')
            return
        }

        // If no tests selected, show confirmation dialog
        if (selectedTests.length === 0 && !showConfirmation) {
            setShowConfirmation(true)
            return
        }

        setIsSubmitting(true)
        setSubmitError(null)
        setSubmitSuccess(null)
        setShowConfirmation(false)

        try {
            if (selectedTests.length === 0) {
                // Create sample WITHOUT tests (new flow)
                const payload: CreateSample = {
                    client_id: selectedClient.id,
                    type: selectedSampleType,
                    client_name: selectedClient.name, // Snapshot
                    received_at: data.received_at ? new Date(data.received_at).toISOString() : undefined,
                }

                const result = await createSampleClient(payload)

                if (result.error) {
                    setSubmitError(result.error)
                } else {
                    const sampleData = result.data
                    const sampleCode = sampleData?.sample_id
                    const sampleId = sampleData?.id
                    setSubmitSuccess(`Mẫu ${sampleCode || ''} đã được tạo.`.trim())
                    setLastSampleId(sampleId || null)

                    // Reset form but keep client selected for convenience? 
                    // Usually better to reset everything to avoid mistakes.
                    reset()
                    setSelectedTests([])
                    setSelectedClient(null)
                    setSelectedSampleType('Máu')
                }
            } else {
                // Create sample WITH tests (existing flow)
                const payload: CreateSampleWithAssignments = {
                    client_id: selectedClient.id,
                    client_name: selectedClient.name, // Snapshot
                    type: selectedSampleType,
                    received_at: data.received_at ? new Date(data.received_at).toISOString() : undefined,
                    tests: selectedTests.map((t) => ({
                        assayId: t.assayId,
                        methodId: t.methodId,
                    })),
                }

                const result = await accessionAndAssignTestsClient(payload)

                if (result.error) {
                    setSubmitError(result.error)
                } else {
                    const payload = Array.isArray(result.data) ? result.data[0] : result.data
                    const sampleData = payload?.sample
                    const sampleCode = sampleData?.sample_id
                    const sampleId = sampleData?.id
                    const assignedCount = payload?.results?.length || selectedTests.length
                    setSubmitSuccess(`Mẫu ${sampleCode || ''} đã được tạo và chỉ định ${assignedCount} xét nghiệm.`.trim())
                    setLastSampleId(sampleId || null)

                    reset()
                    setSelectedTests([])
                    setSelectedClient(null)
                    setSelectedSampleType('Máu')
                }
            }
        } catch (error) {
            setSubmitError('Đã có lỗi xảy ra')
        }

        setIsSubmitting(false)
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
                        {/* Client Selector */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Khách hàng *
                            </Label>
                            <ClientSelector
                                selectedClient={selectedClient}
                                onSelect={setSelectedClient}
                            />
                        </div>

                        {/* Sample Type Selector */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Loại mẫu *
                            </Label>
                            <SampleTypeSelector
                                value={selectedSampleType}
                                onChange={setSelectedSampleType}
                            />
                        </div>

                        {/* Received At Field (Optional) */}
                        <div className="space-y-2">
                            <Label htmlFor="received_at" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Thời gian nhận
                            </Label>
                            <Input
                                id="received_at"
                                type="datetime-local"
                                {...register('received_at')}
                                className="shadow-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Tùy chọn. Mặc định là hiện tại.
                            </p>
                            {errors.received_at && (
                                <p className="text-sm text-destructive">{errors.received_at.message}</p>
                            )}
                        </div>

                        {/* Confirmation Dialog for No Tests */}
                        {showConfirmation && (
                            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <div className="flex-1">
                                        <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                                            Tạo mẫu không có xét nghiệm?
                                        </h4>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                                            Bạn chưa chọn xét nghiệm nào. Mẫu sẽ được tạo với trạng thái "Đã tiếp nhận" và bạn có thể chỉ định xét nghiệm sau.
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowConfirmation(false)}
                                                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                                            >
                                                Hủy
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => handleSubmit(onSubmit)()}
                                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                            >
                                                Tiếp tục
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit Error */}
                        {submitError && (
                            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                {submitError}
                            </div>
                        )}

                        {/* Success Message */}
                        {submitSuccess && (
                            <div className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 p-3 rounded-md text-sm flex flex-col gap-2 border border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-center gap-2 font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {submitSuccess}
                                </div>
                                {lastSampleId && (
                                    <div className="flex gap-2">
                                        <Link href={`/analyst/samples?sampleId=${lastSampleId}`} className="w-full">
                                            <Button variant="secondary" className="w-full bg-white shadow-sm hover:bg-slate-50 text-emerald-700 border border-emerald-200">
                                                Mở chi tiết mẫu
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                }
            />
        </form>
    )
}

