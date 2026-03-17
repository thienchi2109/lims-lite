'use client'

/**
 * AccessionMobileWizard
 *
 * Orchestrator component replacing AccessionMobileLayout for mobile view.
 * Manages 4-step wizard flow: Customer → Tests → Review → Success.
 * All business logic/state is received via props from parent.
 */

import { useState, useCallback } from 'react'
import type { Client, SampleType, SelectedTest, CreateClient, AssayDefinitionWithMethods } from '@/types'
import type { GridRow } from '@/types/test-assignment'
import type { ClientQrScannerDialogSerialController } from '@/components/client-qr-scanner-dialog'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { AccessionWizardStepper } from '@/components/accession-wizard-stepper'
import { AccessionWizardStepCustomer } from '@/components/accession-wizard-step-customer'
import { AccessionWizardStepTests } from '@/components/accession-wizard-step-tests'
import { AccessionWizardStepReview } from '@/components/accession-wizard-step-review'
import { AccessionWizardStepSuccess } from '@/components/accession-wizard-step-success'

export interface AccessionMobileWizardProps {
    /* Customer / QR state (step 1) */
    selectedClient: Client | null
    onSelectClient: (client: Client | null) => void
    showClientForm: boolean
    onOpenFormChange: (open: boolean) => void
    clientFormData: Partial<CreateClient> | undefined
    onFormDataChange: (data: Partial<CreateClient> | undefined) => void
    showQRScanner: boolean
    onShowQRScanner: (show: boolean) => void
    onQRScan: (decodedText: string) => void
    serialController?: ClientQrScannerDialogSerialController
    selectedSampleType: SampleType
    onSampleTypeChange: (type: SampleType) => void
    receivedAtRegister: UseFormRegisterReturn<'received_at'>
    receivedAtValue: string

    /* Test selection state (step 2) */
    searchQuery: string
    setSearchQuery: (q: string) => void
    selectedSpecialtyId: string
    setSelectedSpecialtyId: (id: string) => void
    specialties: Array<{ id: string; name: string; code: string }>
    groupedRows: GridRow[]
    isLoading: boolean
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    handleMethodChange: (assayId: string, methodId: string) => void

    /* Submit */
    onSave: () => void
    isSaving: boolean

    /* Success state */
    submitError: string | null
    submitSuccess: string | null
    onReset: () => void
}

export function AccessionMobileWizard(props: AccessionMobileWizardProps) {
    const [currentStep, setCurrentStep] = useState(0)

    const goNext = useCallback(() => {
        setCurrentStep((s) => Math.min(s + 1, 3))
    }, [])

    const goBack = useCallback(() => {
        setCurrentStep((s) => Math.max(s - 1, 0))
    }, [])

    const goToStep = useCallback((step: number) => {
        setCurrentStep(Math.max(0, Math.min(step, 3)))
    }, [])

    const handleConfirm = useCallback(() => {
        props.onSave()
    }, [props.onSave])

    // After successful submit, jump to success step
    const showSuccess = !!props.submitSuccess && currentStep !== 3
    if (showSuccess) {
        // Set step to 3 (success) on next render
        if (currentStep !== 3) setCurrentStep(3)
    }

    const handleNewAccession = useCallback(() => {
        props.onReset()
        setCurrentStep(0)
    }, [props.onReset])

    const canAdvanceStep1 = !!props.selectedClient

    return (
        <div className="relative flex h-full flex-col bg-background">
            {/* Stepper — hide on success */}
            {currentStep < 3 && (
                <div className="shrink-0 border-b border-border bg-background px-2">
                    <AccessionWizardStepper currentStep={currentStep} />
                </div>
            )}

            {/* Step content */}
            <div className="relative flex-1 overflow-hidden">
                {currentStep === 0 && (
                    <AccessionWizardStepCustomer
                        selectedClient={props.selectedClient}
                        onSelectClient={props.onSelectClient}
                        showClientForm={props.showClientForm}
                        onOpenFormChange={props.onOpenFormChange}
                        clientFormData={props.clientFormData}
                        onFormDataChange={props.onFormDataChange}
                        showQRScanner={props.showQRScanner}
                        onShowQRScanner={props.onShowQRScanner}
                        onQRScan={props.onQRScan}
                        serialController={props.serialController}
                        selectedSampleType={props.selectedSampleType}
                        onSampleTypeChange={props.onSampleTypeChange}
                        receivedAtRegister={props.receivedAtRegister}
                        onNext={goNext}
                        canAdvance={canAdvanceStep1}
                    />
                )}

                {currentStep === 1 && (
                    <AccessionWizardStepTests
                        searchQuery={props.searchQuery}
                        setSearchQuery={props.setSearchQuery}
                        selectedSpecialtyId={props.selectedSpecialtyId}
                        setSelectedSpecialtyId={props.setSelectedSpecialtyId}
                        specialties={props.specialties}
                        groupedRows={props.groupedRows}
                        isLoading={props.isLoading}
                        disabledSet={props.disabledSet}
                        specialtiesMap={props.specialtiesMap}
                        selected={props.selected}
                        onChange={props.onChange}
                        toggleTestSelection={props.toggleTestSelection}
                        handleMethodChange={props.handleMethodChange}
                        onNext={goNext}
                        onBack={goBack}
                    />
                )}

                {currentStep === 2 && (
                    <AccessionWizardStepReview
                        selectedClient={props.selectedClient}
                        selectedSampleType={props.selectedSampleType}
                        receivedAt={props.receivedAtValue}
                        selected={props.selected}
                        submitError={props.submitError}
                        onBack={goBack}
                        onGoToStep={goToStep}
                        onConfirm={handleConfirm}
                        isSaving={props.isSaving}
                    />
                )}

                {currentStep === 3 && props.submitSuccess && (
                    <AccessionWizardStepSuccess
                        successMessage={props.submitSuccess}
                        clientName={props.selectedClient?.name || ''}
                        sampleType={props.selectedSampleType}
                        testCount={props.selected.length}
                        onNewAccession={handleNewAccession}
                    />
                )}
            </div>
        </div>
    )
}
