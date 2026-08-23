'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    type CreateClient,
    type CreateSampleWithClientResolution,
    type CreateSampleWithAssignmentsAndClientResolution,
    type LabSpecialty,
    type SelectedTest,
} from '@/types'
import {
    assignManualAccessionTestsClient,
    assignQrAccessionTestsClient,
    createManualAccessionSampleClient,
    createQrAccessionSampleClient,
} from '@/lib/api-client'
import {
    createExistingAccessionSelection,
    type AccessionClientSelection,
} from '@/lib/client-resolution/accession'
import { printSampleBarcodeLabel } from '@/lib/sample-label-print-client'
import type { SampleLabelPreset } from '@/lib/sample-label-template'
import {
    parseClientIdentityQr,
} from '@/lib/qr/parse-client-identity-qr'
import { useClientIdentityScan } from '@/hooks/use-client-identity-scan'
import { usePublishedAssignmentCatalog } from '@/hooks/use-published-assignment-catalog'
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
const RELOAD_ASSIGNMENT_MESSAGE =
    'Dữ liệu chỉ định đã cũ. Vui lòng tải lại trang và chọn lại loại mẫu.'

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

    const [selectedClient, setSelectedClient] =
        useState<AccessionClientSelection | null>(null)
    const [selectedSampleTypeId, setSelectedSampleTypeId] = useState<string | null>(null)
    const [selectionRevisionNumber, setSelectionRevisionNumber] =
        useState<number | null>(null)
    const {
        catalog,
        error: compatibilityError,
        isLoading: compatibilityLoading,
        reload: reloadCompatibility,
    } = usePublishedAssignmentCatalog()
    const sampleTypes = useMemo(() => catalog?.sampleTypes ?? [], [catalog])
    const selectedSampleType = useMemo(
        () => sampleTypes.find((sampleType) => sampleType.id === selectedSampleTypeId)
            ?? sampleTypes[0]
            ?? null,
        [sampleTypes, selectedSampleTypeId],
    )
    const effectiveSampleTypeId = selectedSampleType?.id ?? null
    const allowedAssayIds = useMemo(
        () => catalog?.assays
            .filter((assay) => assay.sampleTypeId === effectiveSampleTypeId)
            .map((assay) => assay.assayDefinitionId) ?? [],
        [catalog, effectiveSampleTypeId],
    )

    const revisionNumber = catalog?.revisionNumber ?? null
    if (revisionNumber !== null && revisionNumber !== selectionRevisionNumber) {
        setSelectionRevisionNumber(revisionNumber)
        if (selectionRevisionNumber !== null) {
            setSelectedTests([])
        }
    }

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

    const handleSampleTypeChange = useCallback((sampleTypeId: string) => {
        if (sampleTypeId === effectiveSampleTypeId) return
        if (selectedTests.length > 0) {
            toast.info('Danh sách chỉ tiêu đã được cập nhật theo loại mẫu đã chọn.')
        }
        setSelectedSampleTypeId(sampleTypeId)
        setSelectedTests([])
        setSubmitError(null)
    }, [effectiveSampleTypeId, selectedTests.length])

    const handleAssignmentError = useCallback((error: unknown) => {
        const message = error instanceof Error && error.message.trim()
            ? error.message
            : typeof error === 'string' && error.trim()
                ? error
                : RELOAD_ASSIGNMENT_MESSAGE
        setSubmitError(message)
        setSelectedTests([])
        reloadCompatibility()
    }, [reloadCompatibility])

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

        if (!selectedSampleType || !catalog?.revisionNumber) {
            setSubmitError(RELOAD_ASSIGNMENT_MESSAGE)
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
                const payload: CreateSampleWithClientResolution = {
                    ...(selectedClient.kind === 'existing'
                        ? {
                            client_id: selectedClient.client.id,
                            client_name: selectedClient.client.name,
                        }
                        : {}),
                    type: selectedSampleType.name,
                    sample_quality: sampleQuality,
                    received_at: data.received_at ? new Date(data.received_at).toISOString() : undefined,
                    sampleTypeId: selectedSampleType.id,
                    sampleTypeCode: selectedSampleType.importCode,
                    expectedRevisionNumber: catalog.revisionNumber,
                    client_resolution: selectedClient.resolution,
                }

                const createSampleForWorkflow =
                    selectedClient.workflow === 'qr'
                        ? createQrAccessionSampleClient
                        : createManualAccessionSampleClient
                const result = await createSampleForWorkflow(payload)

                if (result.error) {
                    handleAssignmentError(result.error)
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
                const payload: CreateSampleWithAssignmentsAndClientResolution = {
                    ...(selectedClient.kind === 'existing'
                        ? {
                            client_id: selectedClient.client.id,
                            client_name: selectedClient.client.name,
                        }
                        : {}),
                    type: selectedSampleType.name,
                    sample_quality: sampleQuality,
                    received_at: data.received_at ? new Date(data.received_at).toISOString() : undefined,
                    tests: selectedTests.map((t) => ({
                        assayId: t.assayId,
                        methodId: t.methodId,
                    })),
                    sampleTypeId: selectedSampleType.id,
                    sampleTypeCode: selectedSampleType.importCode,
                    expectedRevisionNumber: catalog.revisionNumber,
                    client_resolution: selectedClient.resolution,
                }

                const assignTestsForWorkflow =
                    selectedClient.workflow === 'qr'
                        ? assignQrAccessionTestsClient
                        : assignManualAccessionTestsClient
                const result = await assignTestsForWorkflow(payload)

                if (result.error) {
                    handleAssignmentError(result.error)
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
        } catch (error) {
            handleAssignmentError(error)
        }

        setIsSubmitting(false)
    }

    const {
        handleIdentityScan: handleParsedIdentityScan,
        invalidateIdentityScan,
    } = useClientIdentityScan({
        onDraft: (draft) => {
            setShowQRScanner(false)
            setSelectedClient(null)
            setClientFormData(draft)
            setShowClientForm(true)
        },
        onExistingClient: (client) => {
            setSelectedClient(createExistingAccessionSelection(client, 'qr'))
            setClientFormData(undefined)
            setShowClientForm(false)
            toast.success(`Đã tìm thấy khách hàng: ${client.name}`)
        },
        onLookupError: (error) => {
            console.error('Error searching client', error)
        },
    })

    const handleDraftOwnershipChange = useCallback(() => {
        invalidateIdentityScan()
    }, [invalidateIdentityScan])

    const handleInvalidQRScan = useCallback(() => {
        handleDraftOwnershipChange()
        setShowQRScanner(false)
        toast.error('Mã QR không hợp lệ. Vui lòng thử lại hoặc nhập thủ công.')
    }, [handleDraftOwnershipChange])

    const handleQRScan = useCallback(async (decodedText: string) => {
        const parsed = parseClientIdentityQr(decodedText)
        if (!parsed) {
            handleInvalidQRScan()
            return
        }

        await handleParsedIdentityScan(parsed)
    }, [handleInvalidQRScan, handleParsedIdentityScan])

    const handleResetForm = useCallback(() => {
        invalidateIdentityScan()
        reset()
        setSelectedTests([])
        setSelectedClient(null)
        setSelectedSampleTypeId(sampleTypes[0]?.id ?? null)
        setSampleQuality(null)
        setClientFormData(undefined)
        setSubmitSuccess(null)
        setSubmitError(null)
        setCreatedSampleId(null)
    }, [invalidateIdentityScan, reset, sampleTypes])

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
            onDraftOwnershipChange={handleDraftOwnershipChange}
            sampleTypes={sampleTypes}
            selectedSampleTypeId={effectiveSampleTypeId}
            onSampleTypeChange={handleSampleTypeChange}
            compatibilityLoading={compatibilityLoading}
            compatibilityError={compatibilityError}
            revisionNumber={catalog?.revisionNumber ?? null}
            onReloadCompatibility={reloadCompatibility}
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
        onDraftOwnershipChange: handleDraftOwnershipChange,
        showQRScanner,
        onShowQRScanner: setShowQRScanner,
        onQRScan: handleQRScan,
        onIdentityScan: handleParsedIdentityScan,
            onInvalidScan: handleInvalidQRScan,
            sampleTypes,
            selectedSampleTypeId: effectiveSampleTypeId,
            selectedSampleType: selectedSampleType?.name ?? '',
            onSampleTypeChange: handleSampleTypeChange,
        compatibilityLoading,
        compatibilityError,
        revisionNumber: catalog?.revisionNumber ?? null,
        onReloadCompatibility: reloadCompatibility,
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
        handleDraftOwnershipChange,
        sampleTypes, effectiveSampleTypeId, selectedSampleType,
        handleSampleTypeChange, compatibilityLoading, compatibilityError,
        catalog?.revisionNumber, reloadCompatibility,
        sampleQuality, register, receivedAtWatched,
        submitError, submitSuccess, handleResetForm,
    ])

    return (
        <>
            <form onSubmit={handleSubmit(onSubmit)} className="h-full" id="tour-accession-form">
                <div id="tour-test-assignment">
                    <TestAssignmentGrid
                    selected={selectedTests}
                    onChange={setSelectedTests}
                    allowedAssayIds={allowedAssayIds}
                    specialties={specialties}
                    context={contextContent}
                    isSaving={isSubmitting}
                    isSaveDisabled={
                        !!submitSuccess
                        || sampleQuality === null
                        || compatibilityLoading
                        || !!compatibilityError
                        || !selectedSampleType
                        || !catalog?.revisionNumber
                    }
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
