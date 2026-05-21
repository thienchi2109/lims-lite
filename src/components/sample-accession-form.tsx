'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { type CreateSampleWithAssignments, type CreateSample, type Client, type CreateClient, type LabSpecialty, type SampleType, type SelectedTest } from '@/types'
import { accessionAndAssignTestsClient, createSampleClient, findClientByIdentityClient } from '@/lib/api-client'
import { printSampleBarcodeLabel } from '@/lib/sample-label-print-client'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TestAssignmentGrid } from '@/components/test-assignment-grid'
import { CheckCircle2, AlertCircle, QrCode, Scan, Calendar, Barcode } from 'lucide-react'
import { ClientSelector } from '@/components/client-selector'
import { SampleTypeSelector } from '@/components/sample-type-selector'
import { useCccdSerialController } from '@/hooks/use-cccd-serial-controller'
import { toast } from 'sonner'

const EMPTY_SPECIALTIES: LabSpecialty[] = []

interface SampleAccessionFormProps {
    specialties?: LabSpecialty[]
}

export function SampleAccessionForm({ specialties = EMPTY_SPECIALTIES }: SampleAccessionFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
    const [createdSampleId, setCreatedSampleId] = useState<string | null>(null)
    const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([])
    const [showConfirmation, setShowConfirmation] = useState(false)

    // New state for Client and Sample Type
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)

    const [selectedSampleType, setSelectedSampleType] = useState<SampleType>('Máu')

    // QR & Client Form State (Lifted for Mobile UI)
    const [showQRScanner, setShowQRScanner] = useState(false)
    const [showClientForm, setShowClientForm] = useState(false)
    const [clientFormData, setClientFormData] = useState<Partial<CreateClient> | undefined>(undefined)

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
        reset,
        setValue,
        watch,
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

    const receivedAtWatched = watch('received_at')

    const onSubmit = async (data: FormData) => {
        if (submitSuccess) {
            return
        }

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
        setCreatedSampleId(null)
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
                    setCreatedSampleId(sampleData?.id ?? null)
                    setSubmitSuccess(`Mẫu ${sampleCode || ''} đã được tạo.`.trim())
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
                    const assignedCount = payload?.results?.length || selectedTests.length
                    setCreatedSampleId(sampleData?.id ?? null)
                    setSubmitSuccess(`Mẫu ${sampleCode || ''} đã được tạo và chỉ định ${assignedCount} xét nghiệm.`.trim())
                }
            }
        } catch {
            setSubmitError('Đã có lỗi xảy ra')
        }

        setIsSubmitting(false)
    }

    const handleQRScan = useCallback(async (decodedText: string) => {
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
    }, [])

    const serialController = useCccdSerialController({
        active: showQRScanner,
        onPayload: handleQRScan,
    })

    const handleResetForm = useCallback(() => {
        reset()
        setSelectedTests([])
        setSelectedClient(null)
        setSelectedSampleType('Máu')
        setClientFormData(undefined)
        setSubmitSuccess(null)
        setSubmitError(null)
        setCreatedSampleId(null)
    }, [reset])

    const handlePrintBarcodeLabel = useCallback(() => {
        if (!createdSampleId) return
        void printSampleBarcodeLabel(createdSampleId, { preset: 'small-tube' })
    }, [createdSampleId])

    // Context Content (Card Style)
    const contextContent = (
        <div className="space-y-6 lg:space-y-6">
            {/* QR Card (Mobile Only or Highlighted) */}
            <div id="tour-qr-scanner" className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
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
                    className="group w-full rounded-xl border border-sky-200/80 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 px-4 py-3 text-sky-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md active:translate-y-0 dark:border-sky-800/70 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/30 dark:text-sky-300"
                >
                    <span className="flex items-center justify-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-sky-600 shadow-sm dark:bg-slate-900/70 dark:text-sky-300">
                            <Scan size={18} />
                        </span>
                        <span className="font-medium tracking-tight">Quét mã QR trên CCCD</span>
                    </span>
                </button>
            </div>

            {/* Sample Info Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-0 text-sm">Thông tin mẫu</h2>

                {/* Client Selector (Styled as Input Group) */}
                <div id="tour-client-selector" className="space-y-1">
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
                <div id="tour-sample-type" className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Loại mẫu *
                    </Label>
                    <SampleTypeSelector
                        value={selectedSampleType}
                        onChange={setSelectedSampleType}
                    />
                </div>

                {/* Received Time */}
                <div id="tour-received-time" className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Thời gian nhận
                    </Label>
                    <div className="relative min-w-0">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                            <Calendar size={18} />
                        </div>
                        <Input
                            type="datetime-local"
                            {...register('received_at')}
                            className="mobile-date-input-fix h-11 bg-slate-50 pl-10 text-sm [appearance:textfield] border-slate-200 dark:border-slate-700 dark:bg-slate-800"
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
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {createdSampleId && (
                            <Button
                                type="button"
                                variant="default"
                                className="w-full sm:w-auto"
                                onClick={handlePrintBarcodeLabel}
                            >
                                <Barcode className="mr-2 h-4 w-4" />
                                In nhãn barcode
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={handleResetForm}
                        >
                            Tiếp nhận mẫu mới
                        </Button>
                    </div>
                </div>
            )}

            <ClientQrScannerDialog
                open={showQRScanner}
                onOpenChange={setShowQRScanner}
                onScan={handleQRScan}
                serialController={serialController}
            />
        </div>
    )

    const wizardProps = useMemo(() => ({
        selectedClient,
        onSelectClient: setSelectedClient,
        showClientForm,
        onOpenFormChange: setShowClientForm,
        clientFormData,
        onFormDataChange: setClientFormData,
        showQRScanner,
        onShowQRScanner: setShowQRScanner,
        onQRScan: handleQRScan,
        serialController,
        selectedSampleType,
        onSampleTypeChange: setSelectedSampleType,
        receivedAtRegister: register('received_at'),
        receivedAtValue: receivedAtWatched || '',
        submitError,
        submitSuccess,
        onReset: handleResetForm,
    }), [
        selectedClient, showClientForm, clientFormData,
        showQRScanner, handleQRScan, serialController,
        selectedSampleType, register, receivedAtWatched,
        submitError, submitSuccess, handleResetForm,
    ])

    return (
        <>
            <form onSubmit={handleSubmit(onSubmit)} className="h-full" id="tour-accession-form">
                <div id="tour-test-assignment">
                    <TestAssignmentGrid
                    selected={selectedTests}
                    onChange={setSelectedTests}
                    specialties={specialties}
                    context={contextContent}
                    isSaving={isSubmitting}
                    isSaveDisabled={!!submitSuccess}
                    onSave={handleSubmit(onSubmit)}
                    saveLabel={selectedTests.length > 0
                        ? `Lưu & Chỉ định (${selectedTests.length})`
                        : "Lưu mẫu (Không chỉ định)"}
                    wizardProps={wizardProps}
                />
                </div>
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
