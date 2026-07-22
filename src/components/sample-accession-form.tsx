'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    type Client,
    type CreateClient,
    type CreateSample,
    type CreateSampleWithAssignments,
    type LabSpecialty,
    type SampleType,
    type SelectedTest,
} from '@/types'
import { accessionAndAssignTestsClient, createSampleClient, findClientByIdentityClient } from '@/lib/api-client'
import { printSampleBarcodeLabel } from '@/lib/sample-label-print-client'
import type { SampleLabelPreset } from '@/lib/sample-label-template'
import {
    parseClientIdentityQr,
    type ParsedClientIdentityQr,
} from '@/lib/qr/parse-client-identity-qr'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TestAssignmentGrid } from '@/components/test-assignment-grid'
import { SampleAccessionContext } from '@/components/sample-accession-context'
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
    const [sampleQuality, setSampleQuality] = useState<boolean | null>(null)
    const [showConfirmation, setShowConfirmation] = useState(false)
    const [showLabelPrintDialog, setShowLabelPrintDialog] = useState(false)

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
            methodId: z.string().nullable(),
        })).optional(),
    })

    type FormData = z.infer<typeof FormSchema>

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        control,
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

    const receivedAtWatched = useWatch({
        control,
        name: 'received_at',
    })

    const onSubmit = async (data: FormData) => {
        if (submitSuccess) {
            return
        }

        // Validate Client Selection
        if (!selectedClient) {
            setSubmitError('Vui lòng chọn khách hàng')
            return
        }

        if (sampleQuality === null) {
            setSubmitError('Vui lòng chọn chất lượng mẫu')
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
                    sample_quality: sampleQuality,
                    client_name: selectedClient.name, // Snapshot
                    received_at: data.received_at ? new Date(data.received_at).toISOString() : undefined,
                }

                const result = await createSampleClient(payload)

                if (result.error) {
                    setSubmitError(result.error)
                } else {
                    const sampleData = result.data
                    const sampleCode = sampleData?.sample_id
                    const successMessage = `Mẫu ${sampleCode || ''} đã được tạo.`.trim()
                    setCreatedSampleId(sampleData?.id ?? null)
                    setSubmitSuccess(successMessage)
                    toast.success(successMessage)
                }
            } else {
                // Create sample WITH tests (existing flow)
                const payload: CreateSampleWithAssignments = {
                    client_id: selectedClient.id,
                    client_name: selectedClient.name, // Snapshot
                    type: selectedSampleType,
                    sample_quality: sampleQuality,
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
                    const successMessage = `Mẫu ${sampleCode || ''} đã được tạo và chỉ định ${assignedCount} xét nghiệm.`.trim()
                    setCreatedSampleId(sampleData?.id ?? null)
                    setSubmitSuccess(successMessage)
                    toast.success(successMessage)
                }
            }
        } catch {
            setSubmitError('Đã có lỗi xảy ra')
        }

        setIsSubmitting(false)
    }

    const handleInvalidQRScan = useCallback(() => {
        setShowQRScanner(false)
        toast.error('Mã QR không hợp lệ. Vui lòng thử lại hoặc nhập thủ công.')
    }, [])

    const handleParsedIdentityScan = useCallback(async (parsed: ParsedClientIdentityQr) => {
        setShowQRScanner(false)
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

    const handleQRScan = useCallback(async (decodedText: string) => {
        const parsed = parseClientIdentityQr(decodedText)
        if (!parsed) {
            handleInvalidQRScan()
            return
        }

        await handleParsedIdentityScan(parsed)
    }, [handleInvalidQRScan, handleParsedIdentityScan])

    const handleResetForm = useCallback(() => {
        reset()
        setSelectedTests([])
        setSelectedClient(null)
        setSelectedSampleType('Máu')
        setSampleQuality(null)
        setClientFormData(undefined)
        setSubmitSuccess(null)
        setSubmitError(null)
        setCreatedSampleId(null)
    }, [reset])

    const handlePrintBarcodeLabel = useCallback(() => {
        if (!createdSampleId) return
        setShowLabelPrintDialog(true)
    }, [createdSampleId])

    const handleConfirmPrintBarcodeLabel = useCallback((preset: SampleLabelPreset) => {
        if (!createdSampleId) return
        void printSampleBarcodeLabel(createdSampleId, { preset })
    }, [createdSampleId])

    const createdSampleHref = createdSampleId
        ? `/samples?sampleId=${encodeURIComponent(createdSampleId)}`
        : null

    const contextContent = (
        <SampleAccessionContext
            selectedClient={selectedClient}
            onSelectClient={setSelectedClient}
            showClientForm={showClientForm}
            onOpenClientFormChange={setShowClientForm}
            clientFormData={clientFormData}
            onClientFormDataChange={setClientFormData}
            selectedSampleType={selectedSampleType}
            onSampleTypeChange={setSelectedSampleType}
            sampleQuality={sampleQuality}
            onSampleQualityChange={setSampleQuality}
            receivedAtRegister={register('received_at')}
            showQRScanner={showQRScanner}
            onShowQRScannerChange={setShowQRScanner}
            onQRScan={handleQRScan}
            onIdentityScan={handleParsedIdentityScan}
            onInvalidScan={handleInvalidQRScan}
            submitError={submitError}
            submitSuccess={submitSuccess}
            createdSampleHref={createdSampleHref}
            createdSampleId={createdSampleId}
            onPrintBarcodeLabel={handlePrintBarcodeLabel}
            onReset={handleResetForm}
            showLabelPrintDialog={showLabelPrintDialog}
            onShowLabelPrintDialogChange={setShowLabelPrintDialog}
            onConfirmPrintBarcodeLabel={handleConfirmPrintBarcodeLabel}
        />
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
        onIdentityScan: handleParsedIdentityScan,
        onInvalidScan: handleInvalidQRScan,
        selectedSampleType,
        onSampleTypeChange: setSelectedSampleType,
        sampleQuality,
        onSampleQualityChange: setSampleQuality,
        receivedAtRegister: register('received_at'),
        receivedAtValue: receivedAtWatched || '',
        submitError,
        submitSuccess,
        onReset: handleResetForm,
    }), [
        selectedClient, showClientForm, clientFormData,
        showQRScanner, handleQRScan, handleParsedIdentityScan, handleInvalidQRScan,
        selectedSampleType, sampleQuality, register, receivedAtWatched,
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
                    isSaveDisabled={!!submitSuccess || sampleQuality === null}
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
