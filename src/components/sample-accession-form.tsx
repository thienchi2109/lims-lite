'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateSampleWithAssignmentsSchema, type CreateSampleWithAssignments, type CreateSample, type Client, type CreateClient, type LabSpecialty, type SampleType, type SelectedTest } from '@/types'
import { accessionAndAssignTestsClient, createSampleClient, findClientByIdentityClient } from '@/lib/api-client'
import { parseClientIdentityQr } from '@/lib/qr/parse-client-identity-qr'
import { ClientQrScannerDialog } from '@/components/client-qr-scanner-dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TestAssignmentGrid } from '@/components/test-assignment-grid'
import { Loader2, CheckCircle2, AlertCircle, QrCode, Scan, Calendar } from 'lucide-react'
import Link from 'next/link'
import { ClientSelector } from '@/components/client-selector'
import { SampleTypeSelector } from '@/components/sample-type-selector'
import { useMediaQuery } from '@/hooks/use-media-query'
import { toast } from 'sonner'

interface SampleAccessionFormProps {
    specialties?: LabSpecialty[]
}

export function SampleAccessionForm({ specialties = [] }: SampleAccessionFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
    const [lastSampleId, setLastSampleId] = useState<string | null>(null)
    const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([])
    const [showConfirmation, setShowConfirmation] = useState(false)

    // New state for Client and Sample Type
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)

    const [selectedSampleType, setSelectedSampleType] = useState<SampleType>('Máu')

    // QR & Client Form State (Lifted for Mobile UI)
    const [showQRScanner, setShowQRScanner] = useState(false)
    const [showClientForm, setShowClientForm] = useState(false)
    const [clientFormData, setClientFormData] = useState<Partial<CreateClient> | undefined>(undefined)

    const isDesktop = useMediaQuery("(min-width: 1024px)")

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
        watch
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

    const handleQRScan = async (decodedText: string) => {
        setShowQRScanner(false)

        const parsed = parseClientIdentityQr(decodedText)
        if (!parsed) {
            toast.error('Mã QR không hợp lệ. Vui lòng thử lại hoặc nhập thủ công.')
            return
        }

        const { idCardNum, name, dateOfBirth, gender } = parsed
        const address = parsed.address

        try {
            const result = await findClientByIdentityClient(name, dateOfBirth)

            if (result.data) {
                setSelectedClient(result.data)
                toast.success(`Đã tìm thấy khách hàng: ${result.data.name}`)
                return
            }
        } catch (error) {
            console.error('Error searching client', error)
        }

        const formData = {
            name,
            id_card_num: idCardNum || '',
            date_of_birth: dateOfBirth,
            gender,
            phone: '', // Required
            address: address || '',
        }

        setClientFormData(formData)
        setShowClientForm(true)
    }

    // Context Content (Card Style)
    const contextContent = (
        <div className="space-y-6 lg:space-y-6">
            {/* QR Card (Mobile Only or Highlighted) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                        <QrCode className="text-blue-500" size={20} />
                        Quét mã QR
                    </h2>
                    <span className="text-xs text-slate-400">Tự động điền</span>
                </div>
                <button
                    type="button"
                    onClick={() => setShowQRScanner(true)}
                    className="w-full py-3 border-2 border-dashed border-blue-500/50 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all active:scale-[0.98]"
                >
                    <Scan size={20} />
                    <span className="font-medium">Bấm để quét mã khách hàng</span>
                </button>
            </div>

            {/* Sample Info Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-0 text-sm">Thông tin mẫu</h2>

                {/* Client Selector (Styled as Input Group) */}
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Khách hàng *
                    </Label>
                    <div className="relative">
                        <ClientSelector
                            selectedClient={selectedClient}
                            onSelect={setSelectedClient}
                            isOpenForm={showClientForm}
                            onOpenFormChange={setShowClientForm}
                            formData={clientFormData}
                            onFormDataChange={setClientFormData}
                            hideQRButton={true}
                        />
                        {/* Plus button is handled inside ClientSelector via generic "New" action or search, 
                            but to match design strictly we might want the absolute button. 
                            However, the modified ClientSelector Trigger already covers the 'Input' look. 
                            We'll rely on ClientSelector's internal 'Plus' or the popover flow. 
                        */}
                    </div>
                </div>

                {/* Sample Type */}
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Loại mẫu *
                    </Label>
                    <SampleTypeSelector
                        value={selectedSampleType}
                        onChange={setSelectedSampleType}
                    />
                </div>

                {/* Received Time */}
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Thời gian nhận
                    </Label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                            <Calendar size={18} />
                        </div>
                        <Input
                            type="datetime-local"
                            {...register('received_at')}
                            className="pl-10 h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Mặc định là thời gian hiện tại.</p>
                </div>
            </div>

            {/* Error/Success Messages */}
            {submitError && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {submitError}
                </div>
            )}
            {submitSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 p-3 rounded-md text-sm flex flex-col gap-2 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        {submitSuccess}
                    </div>
                </div>
            )}

            <ClientQrScannerDialog open={showQRScanner} onOpenChange={setShowQRScanner} onScan={handleQRScan} />
        </div>
    )

    return (
        <>
            <form onSubmit={handleSubmit(onSubmit)} className="h-full">
                <TestAssignmentGrid
                    selected={selectedTests}
                    onChange={setSelectedTests}
                    specialties={specialties}
                    context={contextContent}
                    isSaving={isSubmitting}
                    onSave={handleSubmit(onSubmit)}
                    saveLabel={selectedTests.length > 0
                        ? `Lưu & Chỉ định (${selectedTests.length})`
                        : "Lưu mẫu (Không chỉ định)"}
                />
            </form>

            <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận tạo mẫu không có chỉ định?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn chưa chọn xét nghiệm nào cho mẫu này. Bạn có chắc chắn muốn tạo mẫu mà không có chỉ định xét nghiệm?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSubmit(onSubmit)}>Tiếp tục tạo mẫu</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
