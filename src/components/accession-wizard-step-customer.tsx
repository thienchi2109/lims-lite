'use client'

/**
 * AccessionWizardStepCustomer
 *
 * Wizard Step 1: Customer information entry.
 * Renders QR scanner button, client selector, sample type, and datetime picker.
 * Extracted from contextContent in sample-accession-form.tsx.
 */

import type { Client, CreateClient, PublishedCatalogSampleType } from '@/types'
import { ClientSelector } from '@/components/client-selector'
import { SampleTypeSelector } from '@/components/sample-type-selector'
import { ClientQrScannerDialog } from '@/components/client-qr-scanner-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { SampleQualityField } from '@/components/sample-quality-field'
import { Scan, Calendar, ArrowRight, RefreshCw } from 'lucide-react'
import type { ParsedClientIdentityQr } from '@/lib/qr/parse-client-identity-qr'
import type { UseFormRegisterReturn } from 'react-hook-form'

interface StepCustomerProps {
    /* Client state */
    selectedClient: Client | null
    onSelectClient: (client: Client | null) => void
    showClientForm: boolean
    onOpenFormChange: (open: boolean) => void
    clientFormData: Partial<CreateClient> | undefined
    onFormDataChange: (data: Partial<CreateClient> | undefined) => void
    onDraftOwnershipChange: () => void
    /* QR state */
    showQRScanner: boolean
    onShowQRScanner: (show: boolean) => void
    onQRScan: (decodedText: string) => void | Promise<void>
    onIdentityScan: (identity: ParsedClientIdentityQr) => void | Promise<void>
    onInvalidScan: () => void
    /* Sample info */
    sampleTypes: PublishedCatalogSampleType[]
    selectedSampleTypeId: string | null
    selectedSampleType: string
    onSampleTypeChange: (sampleTypeId: string) => void
    compatibilityLoading: boolean
    compatibilityError: string | null
    revisionNumber: number | null
    onReloadCompatibility: () => void
    sampleQuality: boolean | null
    onSampleQualityChange: (value: boolean | null) => void
    receivedAtRegister: UseFormRegisterReturn<'received_at'>
    /* Navigation */
    onNext: () => void
    canAdvance: boolean
}

export function AccessionWizardStepCustomer({
    selectedClient,
    onSelectClient,
    showClientForm,
    onOpenFormChange,
    clientFormData,
    onFormDataChange,
    onDraftOwnershipChange,
    showQRScanner,
    onShowQRScanner,
    onQRScan,
    onIdentityScan,
    onInvalidScan,
    sampleTypes,
    selectedSampleTypeId,
    onSampleTypeChange,
    compatibilityLoading,
    compatibilityError,
    revisionNumber,
    onReloadCompatibility,
    sampleQuality,
    onSampleQualityChange,
    receivedAtRegister,
    onNext,
    canAdvance,
}: StepCustomerProps) {
    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 pb-24">
                {/* Section title */}
                <div className="mb-4">
                    <h2 className="text-lg font-bold text-foreground">
                        Thông tin khách hàng
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Nhập thông tin người đến xét nghiệm để tiếp nhận mẫu mới.
                    </p>
                </div>

                {/* QR Scanner Button */}
                <div className="mb-5 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-1">
                    <button
                        type="button"
                        onClick={() => onShowQRScanner(true)}
                        className="flex w-full cursor-pointer items-center gap-4 rounded-lg bg-background p-4 shadow-sm transition-transform duration-200 active:scale-[0.98]"
                    >
                        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Scan className="size-5" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-foreground">
                                Quét mã QR trên CCCD
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Tự động điền thông tin nhanh chóng
                            </div>
                        </div>
                    </button>
                </div>

                {/* Divider */}
                <div className="relative mb-5 flex items-center py-2">
                    <Separator className="flex-1" />
                    <span className="mx-4 shrink-0 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        hoặc nhập thủ công
                    </span>
                    <Separator className="flex-1" />
                </div>

                {/* Form fields */}
                <div className="flex flex-col gap-5">
                    {/* Client selector */}
                    <div>
                        <Label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Khách hàng *
                        </Label>
                        <ClientSelector
                            selectedClient={selectedClient}
                            onSelect={onSelectClient}
                            isOpenForm={showClientForm}
                            onOpenFormChange={onOpenFormChange}
                            formData={clientFormData}
                            onFormDataChange={onFormDataChange}
                            onDraftOwnershipChange={onDraftOwnershipChange}
                            hideQRButton={true}
                        />
                    </div>

                    {/* Sample type */}
                    <div>
                        <Label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Loại mẫu *
                        </Label>
                        <SampleTypeSelector
                            value={selectedSampleTypeId}
                            options={sampleTypes}
                            onChange={onSampleTypeChange}
                            disabled={compatibilityLoading || sampleTypes.length === 0}
                        />
                        <div className="mt-1 flex min-h-7 items-center justify-between gap-2">
                            <span className="text-[10px] text-muted-foreground">
                                {revisionNumber ? `Catalog phiên bản ${revisionNumber}` : compatibilityError}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={onReloadCompatibility}
                                disabled={compatibilityLoading}
                                title="Tải lại catalog tương thích"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${compatibilityLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    <SampleQualityField
                        value={sampleQuality}
                        onChange={onSampleQualityChange}
                    />

                    {/* Received time */}
                    <div>
                        <Label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Thời gian nhận
                        </Label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                <Calendar className="size-[18px]" />
                            </div>
                            <Input
                                type="datetime-local"
                                {...receivedAtRegister}
                                className="h-11 border-border bg-muted/50 pl-10"
                            />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                            Mặc định là thời gian hiện tại.
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-md">
                <Button
                    type="button"
                    variant="outline"
                    disabled
                    className="min-h-11 flex-1"
                >
                    ← Quay lại
                </Button>
                <Button
                    type="button"
                    onClick={onNext}
                    disabled={!canAdvance}
                    className="min-h-11 flex-[1.5] gap-1"
                >
                    Tiếp theo
                    <ArrowRight className="size-4" />
                </Button>
            </div>

            {/* QR Scanner Dialog */}
            <ClientQrScannerDialog
                open={showQRScanner}
                onOpenChange={onShowQRScanner}
                onScan={onQRScan}
                onIdentityScan={onIdentityScan}
                onInvalidScan={onInvalidScan}
            />
        </div>
    )
}
