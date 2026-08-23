'use client'

import type { UseFormRegisterReturn } from 'react-hook-form'
import type { CreateClient, PublishedCatalogSampleType } from '@/types'
import type { AccessionClientSelection } from '@/lib/client-resolution/accession'
import type { SampleLabelPreset } from '@/lib/sample-label-template'
import type { ParsedClientIdentityQr } from '@/lib/qr/parse-client-identity-qr'
import { AlertCircle, Barcode, Calendar, CheckCircle2, Eye, QrCode, RefreshCw, Scan } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClientSelector } from '@/components/client-selector'
import { ClientQrScannerDialog } from '@/components/client-qr-scanner-dialog'
import { SampleLabelPrintDialog } from '@/components/sample-label-print-dialog'
import { SampleQualityField } from '@/components/sample-quality-field'
import { SampleTypeSelector } from '@/components/sample-type-selector'

interface SampleAccessionContextProps {
    selectedClient: AccessionClientSelection | null
    onSelectClient: (client: AccessionClientSelection | null) => void
    showClientForm: boolean
    onOpenClientFormChange: (open: boolean) => void
    clientFormData: Partial<CreateClient> | undefined
    onClientFormDataChange: (data: Partial<CreateClient> | undefined) => void
    onDraftOwnershipChange: () => void
    sampleTypes: PublishedCatalogSampleType[]
    selectedSampleTypeId: string | null
    onSampleTypeChange: (sampleTypeId: string) => void
    compatibilityLoading: boolean
    compatibilityError: string | null
    revisionNumber: number | null
    onReloadCompatibility: () => void
    sampleQuality: boolean | null
    onSampleQualityChange: (value: boolean | null) => void
    receivedAtRegister: UseFormRegisterReturn<'received_at'>
    showQRScanner: boolean
    onShowQRScannerChange: (open: boolean) => void
    onQRScan: (decodedText: string) => void | Promise<void>
    onIdentityScan: (identity: ParsedClientIdentityQr) => void | Promise<void>
    onInvalidScan: () => void
    submitError: string | null
    submitSuccess: string | null
    createdSampleHref: string | null
    createdSampleId: string | null
    onPrintBarcodeLabel: () => void
    onReset: () => void
    showLabelPrintDialog: boolean
    onShowLabelPrintDialogChange: (open: boolean) => void
    onConfirmPrintBarcodeLabel: (preset: SampleLabelPreset) => void
}

export function SampleAccessionContext({
    selectedClient,
    onSelectClient,
    showClientForm,
    onOpenClientFormChange,
    clientFormData,
    onClientFormDataChange,
    onDraftOwnershipChange,
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
    showQRScanner,
    onShowQRScannerChange,
    onQRScan,
    onIdentityScan,
    onInvalidScan,
    submitError,
    submitSuccess,
    createdSampleHref,
    createdSampleId,
    onPrintBarcodeLabel,
    onReset,
    showLabelPrintDialog,
    onShowLabelPrintDialogChange,
    onConfirmPrintBarcodeLabel,
}: SampleAccessionContextProps) {
    return (
        <div className="space-y-6">
            <div
                id="tour-qr-scanner"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        <QrCode className="text-blue-500" size={20} />
                        Quét mã QR
                    </h2>
                    <span className="text-xs text-slate-400">Tự động điền</span>
                </div>
                <button
                    type="button"
                    onClick={() => onShowQRScannerChange(true)}
                    className="group w-full rounded-xl border border-sky-200/80 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 px-4 py-3 text-sky-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md active:translate-y-0 dark:border-sky-800/70 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-indigo-950/30 dark:text-sky-300"
                >
                    <span className="flex items-center justify-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-sky-600 shadow-sm dark:bg-slate-900/70 dark:text-sky-300">
                            <Scan size={18} />
                        </span>
                        <span className="font-medium">Quét mã QR trên CCCD</span>
                    </span>
                </button>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Thông tin mẫu
                </h2>

                <div id="tour-client-selector" className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Khách hàng *
                    </Label>
                    <ClientSelector
                        selectedClient={selectedClient}
                        onSelect={onSelectClient}
                        isOpenForm={showClientForm}
                        onOpenFormChange={onOpenClientFormChange}
                        formData={clientFormData}
                        onFormDataChange={onClientFormDataChange}
                        onDraftOwnershipChange={onDraftOwnershipChange}
                        hideQRButton
                    />
                </div>

                <div id="tour-sample-type" className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Loại mẫu *
                    </Label>
                    <SampleTypeSelector
                        value={selectedSampleTypeId}
                        options={sampleTypes}
                        onChange={onSampleTypeChange}
                        disabled={compatibilityLoading || sampleTypes.length === 0}
                    />
                    <div className="flex min-h-6 items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {revisionNumber ? `Catalog phiên bản ${revisionNumber}` : compatibilityError}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
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

                <div id="tour-received-time" className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Thời gian nhận
                    </Label>
                    <div className="relative min-w-0">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <Calendar size={18} />
                        </div>
                        <Input
                            type="datetime-local"
                            {...receivedAtRegister}
                            className="mobile-date-input-fix h-11 border-slate-200 bg-slate-50 pl-10 text-sm [appearance:textfield] dark:border-slate-700 dark:bg-slate-800"
                        />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                        Mặc định là thời gian hiện tại.
                    </p>
                </div>
            </div>

            {submitError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {submitError}
                </div>
            )}
            {submitSuccess && (
                <div className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        {submitSuccess}
                    </div>
                    <div className="flex flex-col gap-2">
                        {createdSampleHref && (
                            <Button asChild className="w-full min-w-0 whitespace-normal">
                                <Link href={createdSampleHref}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Xem mẫu vừa tạo
                                </Link>
                            </Button>
                        )}
                        {createdSampleId && (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full min-w-0 whitespace-normal"
                                onClick={onPrintBarcodeLabel}
                            >
                                <Barcode className="mr-2 h-4 w-4" />
                                In nhãn barcode
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full min-w-0 whitespace-normal"
                            onClick={onReset}
                        >
                            Tiếp nhận mẫu mới
                        </Button>
                    </div>
                </div>
            )}

            <ClientQrScannerDialog
                open={showQRScanner}
                onOpenChange={onShowQRScannerChange}
                onScan={onQRScan}
                onIdentityScan={onIdentityScan}
                onInvalidScan={onInvalidScan}
            />
            <SampleLabelPrintDialog
                open={showLabelPrintDialog}
                onOpenChange={onShowLabelPrintDialogChange}
                onPrint={onConfirmPrintBarcodeLabel}
            />
        </div>
    )
}
