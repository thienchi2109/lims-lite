'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys, invalidateSampleQueries, approvalKeys, rejectionKeys } from '@/types/query-keys'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { submitSampleForReviewClient } from '@/lib/api-client'
import type { LabSpecialty } from '@/types'
import { ResultCellEditor } from '@/components/result-cell-editor'
import { BatchSaveToolbar } from '@/components/batch-save-toolbar'
import { ResultStatusBadge } from '@/components/result-status-badge'
import { AssignedTestsToolbar } from '@/components/assigned-tests-toolbar'
import { toast } from 'sonner'
import { TestAssignmentModule } from '@/components/test-assignment-module'
import { useResultsEditor } from '@/hooks/use-results-editor'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { useSignatureStatus } from '@/hooks/use-signature-status'
import { useAssignedTestsData } from '@/hooks/use-assigned-tests-data'
import { useCoaActions } from '@/hooks/use-coa-actions'
import { usePrintHandlers } from '@/hooks/use-print-handlers'
import { markLocalSamplesMutation } from '@/lib/samples-realtime'
import { QCRowIndicator } from '@/components/qc/qc-row-indicator'
import { CoAPreviewDialog } from '@/components/coa-preview-dialog'
import { DocumentPreviewDialog } from '@/components/document-preview-dialog'
import type { ResultWithAssay } from '@/types'

interface AssignedTestsPanelProps {
    sampleId: string
    specialties?: LabSpecialty[]
    userRole?: 'analyst' | 'manager'
    initialResults?: ResultWithAssay[]
}

const DEFAULT_SPECIALTIES: LabSpecialty[] = []
const COA_PREVIEW_TITLE = 'Phiếu Kết Quả Phân Tích'
const TEST_ORDER_PREVIEW_TITLE = 'Phiếu chỉ định xét nghiệm'

export function AssignedTestsPanel({
    sampleId,
    specialties = DEFAULT_SPECIALTIES,
    userRole,
    initialResults,
}: AssignedTestsPanelProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const {
        results, loading, error, sampleStatus,
        qcStatuses, coaStatus, enrichmentLoading, enrichmentError, setCoaStatus, fetchTests,
    } = useAssignedTestsData(sampleId, { initialResults })
    const { isGeneratingCoA, handleGenerateCoA } = useCoaActions(sampleId, setCoaStatus)
    const {
        handlePrint,
        handlePrintCoABody,
        handlePrintBarcodeLabel,
        closePrintPreview,
        printPreview,
    } = usePrintHandlers(sampleId, results)
    const [showSubmitDialog, setShowSubmitDialog] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showAssignmentDialog, setShowAssignmentDialog] = useState(false)
    const [previewSampleId, setPreviewSampleId] = useState<string | null>(null)
    const { hasSignature, isLoading: signatureLoading } = useSignatureStatus()

    const handleRefocus = useCallback(
        (targetSampleId: string) => {
            const params = new URLSearchParams(window.location.search)
            params.set('sortBy', 'updated_at')
            params.set('sortOrder', 'desc')
            params.set('sampleId', targetSampleId)
            params.set('page', '1')
            router.push(`?${params.toString()}`)
            markLocalSamplesMutation(targetSampleId)
            queryClient.invalidateQueries({ queryKey: sampleKeys.all })
        },
        [router, queryClient],
    )

    const handleOpenCoAPreview = useCallback(() => setPreviewSampleId(sampleId), [sampleId])
    const handleCloseCoAPreview = useCallback((open: boolean) => {
        if (!open) setPreviewSampleId(null)
    }, [])

    const editor = useResultsEditor({
        results,
        sampleId,
        onSaveSuccess: () => {
            fetchTests()
            handleRefocus(sampleId)
        },
    })
    useUnsavedChangesGuard({
        hasUnsavedChanges: editor.pendingCount > 0,
        onSave: editor.handleSave,
    })

    const isEditable = useCallback(() => {
        if (!sampleStatus) return false
        return ['assigned', 'in_progress'].includes(sampleStatus)
    }, [sampleStatus])

    const handleSubmitForReview = async () => {
        setIsSubmitting(true)
        try {
            const result = await submitSampleForReviewClient(sampleId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Đã gửi mẫu để duyệt')
                setShowSubmitDialog(false)
                await invalidateSampleQueries(queryClient, sampleId, { includeResults: false })
                queryClient.invalidateQueries({ queryKey: approvalKeys.count })
                queryClient.invalidateQueries({ queryKey: rejectionKeys.count })
                fetchTests()
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi gửi duyệt'
            toast.error(message)
            console.error(err)
        }

        setIsSubmitting(false)
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-64 flex-col items-center justify-center text-red-500">
                <AlertCircle className="mb-2 h-8 w-8" />
                <p>{error}</p>
                <Button variant="outline" onClick={fetchTests} className="mt-4">
                    Thử lại
                </Button>
            </div>
        )
    }

    const canEdit = isEditable()
    const allResultsEntered =
        results.length > 0 &&
        results.every((r) => {
            const val = editor.resultValues[r.id] !== undefined ? editor.resultValues[r.id] : r.value
            return val !== null && val !== ''
        })
    const enrichmentMessage = enrichmentError || (enrichmentLoading ? 'Đang tải trạng thái bổ sung...' : null)

    return (
        <div className="relative flex h-full min-h-0 flex-col">
            <AssignedTestsToolbar
                resultsCount={results.length}
                sampleStatus={sampleStatus}
                coaStatus={coaStatus}
                canSubmitForReview={allResultsEntered}
                hasPendingChanges={editor.pendingCount > 0}
                hasSignature={hasSignature}
                signatureLoading={signatureLoading}
                isGeneratingCoA={isGeneratingCoA}
                onPrint={handlePrint}
                onPrintBarcodeLabel={handlePrintBarcodeLabel}
                onGenerateCoA={handleGenerateCoA}
                onSubmitForReview={() => setShowSubmitDialog(true)}
                onOpenAssignment={() => setShowAssignmentDialog(true)}
                onPreviewCoA={handleOpenCoAPreview}
                onPrintCoABody={handlePrintCoABody}
                userRole={userRole}
            />

            {enrichmentMessage && (
                <div className="px-4 pt-2" aria-live="polite">
                    <div
                        className={
                            enrichmentError
                                ? 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'
                                : 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700'
                        }
                    >
                        {enrichmentMessage}
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-auto bg-slate-50/50 p-2">
                <Card id="tour-results-table" className="border-slate-200 shadow-sm">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[25%] font-semibold text-slate-700">Xét nghiệm</TableHead>
                                    <TableHead className="w-[15%] font-semibold text-slate-700">Phương pháp</TableHead>
                                    <TableHead className="w-[20%] font-semibold text-slate-700">Kết quả</TableHead>
                                    <TableHead className="w-[10%] font-semibold text-slate-700">Đơn vị</TableHead>
                                    <TableHead className="w-[15%] font-semibold text-slate-700">Trạng thái</TableHead>
                                    <TableHead className="w-[15%] font-semibold text-slate-700">Người nhập</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-20 text-center text-slate-500">
                                            Chưa có xét nghiệm nào được chỉ định
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    results.map((result) => {
                                        const qcStatus = qcStatuses[result.assay_id]
                                        return (
                                            <TableRow key={result.id} className="group hover:bg-slate-50/50">
                                                <TableCell className="font-medium text-slate-700">
                                                    <div className="flex items-center gap-2">
                                                        {qcStatus && (
                                                            <QCRowIndicator
                                                                status={qcStatus.status}
                                                                message={qcStatus.message}
                                                                lastQCAt={qcStatus.last_qc_at}
                                                            />
                                                        )}
                                                        {result.assay_name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600">{result.method_name || '-'}</TableCell>
                                                <TableCell>
                                                    <ResultCellEditor
                                                        value={editor.getDisplayValue(result)}
                                                        onChange={(val) => editor.handleValueChange(result.id, val)}
                                                        isEditable={canEdit && result.status !== 'approved'}
                                                        validationError={editor.validationErrors[result.id]}
                                                        isPending={editor.resultValues[result.id] !== undefined}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-slate-500">{result.assay_units || '-'}</TableCell>
                                                <TableCell>
                                                    <ResultStatusBadge status={result.status} />
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-500">
                                                    {result.entered_by_name ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-700">{result.entered_by_name}</span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {result.entered_at ? new Date(result.entered_at).toLocaleDateString('vi-VN') : '-'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <div id="tour-batch-save">
                <BatchSaveToolbar
                    pendingCount={editor.pendingCount}
                    onSave={editor.handleSave}
                    onDiscard={editor.handleDiscard}
                    isSaving={editor.isSaving}
                    isVisible={editor.pendingCount > 0}
                />
            </div>

            <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận gửi duyệt</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn gửi mẫu này để duyệt không? Trạng thái mẫu sẽ chuyển sang
                            &quot;Chờ duyệt&quot; và bạn sẽ không thể chỉnh sửa kết quả cho đến khi quản lý phản hồi.
                        </DialogDescription>
                    </DialogHeader>
                    {!signatureLoading && !hasSignature && (
                        <Alert variant="destructive" className="my-4">
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            <AlertTitle>Chữ ký chưa được thiết lập</AlertTitle>
                            <AlertDescription>
                                <Link
                                    href="/profile?tab=signature"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:no-underline"
                                    aria-label="Tải lên chữ ký điện tử"
                                >
                                    Vui lòng tải lên chữ ký điện tử
                                </Link>
                                {' '}trước khi nộp kết quả xét nghiệm.
                            </AlertDescription>
                        </Alert>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={isSubmitting}>
                            Hủy
                        </Button>
                        <Button
                            onClick={handleSubmitForReview}
                            disabled={!hasSignature || signatureLoading || isSubmitting}
                            title={!hasSignature ? "Vui lòng tải lên chữ ký trước khi nộp" : undefined}
                            aria-disabled={!hasSignature || signatureLoading}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {signatureLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang kiểm tra...
                                </>
                            ) : isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang gửi...
                                </>
                            ) : (
                                'Xác nhận gửi'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
                <DialogContent className="max-w-[90vw] overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-[1200px]">
                    <DialogTitle className="sr-only">Chỉ định xét nghiệm</DialogTitle>
                    <DialogDescription className="sr-only">Chọn các xét nghiệm cần chỉ định cho mẫu này</DialogDescription>
                    <TestAssignmentModule
                        sampleId={sampleId}
                        sampleStatus={sampleStatus}
                        onClose={() => setShowAssignmentDialog(false)}
                        onSuccess={fetchTests}
                        onRefocus={handleRefocus}
                        specialties={specialties}
                    />
                </DialogContent>
            </Dialog>
            <CoAPreviewDialog
                open={Boolean(previewSampleId)}
                onOpenChange={handleCloseCoAPreview}
                sampleId={previewSampleId ?? ''}
                title={COA_PREVIEW_TITLE}
                route="staff"
            />
            <DocumentPreviewDialog
                open={printPreview.open}
                onOpenChange={(open) => {
                    if (!open) closePrintPreview()
                }}
                title={TEST_ORDER_PREVIEW_TITLE}
                subtitle={`Mẫu ${sampleId}`}
                loading={printPreview.loading}
                error={printPreview.error}
                html={printPreview.html}
                onRetry={handlePrint}
            />
        </div>
    )
}
