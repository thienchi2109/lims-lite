'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys, invalidateSampleQueries, approvalKeys } from '@/types/query-keys'
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
import { fetchSampleResultsClient, submitSampleForReviewClient } from '@/lib/api-client'
import { fetchSampleDetail } from '@/hooks/use-sample-detail'
import { ResultWithAssay, SampleStatus, type LabSpecialty } from '@/types'
import { ResultCellEditor } from '@/components/result-cell-editor'
import { BatchSaveToolbar } from '@/components/batch-save-toolbar'
import { ResultStatusBadge } from '@/components/result-status-badge'
import { AssignedTestsToolbar } from '@/components/assigned-tests-toolbar'
import { toast } from 'sonner'
import { TestAssignmentModule } from '@/components/test-assignment-module'
import { generatePrintTemplate } from '@/lib/print-template'
import { regenerateCoA, getCoAStatus } from '@/app/actions/coa'
import { useResultsEditor } from '@/hooks/use-results-editor'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { useSignatureStatus } from '@/hooks/use-signature-status'
import { QCRowIndicator } from '@/components/qc/qc-row-indicator'
import { getQCStatusForAssays, type AssayQCStatus } from '@/app/actions/qc-status'
import type { CoAReportStatus } from '@/types'

interface AssignedTestsPanelProps {
    sampleId: string
    specialties?: LabSpecialty[]
    userRole?: 'analyst' | 'manager'
}

export function AssignedTestsPanel({ sampleId, specialties = [], userRole }: AssignedTestsPanelProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()

    // Data fetching state
    const [results, setResults] = useState<ResultWithAssay[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sampleStatus, setSampleStatus] = useState<SampleStatus | null>(null)

    // Dialog state
    const [showSubmitDialog, setShowSubmitDialog] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showAssignmentDialog, setShowAssignmentDialog] = useState(false)

    // CoA state
    const [coaStatus, setCoaStatus] = useState<CoAReportStatus | null>(null)
    const [isGeneratingCoA, setIsGeneratingCoA] = useState(false)

    // QC status state
    const [qcStatuses, setQcStatuses] = useState<Record<string, AssayQCStatus>>({})

    // Signature status hook
    const { hasSignature, isLoading: signatureLoading, error: signatureError } = useSignatureStatus()

    // Log signature fetch errors
    useEffect(() => {
        if (signatureError) {
            console.warn('Failed to fetch signature status:', signatureError)
        }
    }, [signatureError])

    const handleRefocus = useCallback(
        (targetSampleId: string) => {
            const params = new URLSearchParams(searchParams?.toString() ?? '')
            params.set('sortBy', 'updated_at')
            params.set('sortOrder', 'desc')
            params.set('sampleId', targetSampleId)
            params.set('page', '1')
            router.push(`?${params.toString()}`)
            queryClient.invalidateQueries({ queryKey: sampleKeys.all })
        },
        [searchParams, router, queryClient]
    )

    const fetchTests = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error: fetchError } = await fetchSampleResultsClient(sampleId)
            if (fetchError) {
                setError(fetchError)
            } else if (data) {
                setResults(data)
                if (data.length > 0 && data[0].sample_status) {
                    setSampleStatus(data[0].sample_status as SampleStatus)
                }
            }
        } catch (err) {
            setError('Failed to load assigned tests')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [sampleId])

    // Results editor hook
    const editor = useResultsEditor({
        results,
        sampleId,
        onSaveSuccess: () => {
            fetchTests()
            handleRefocus(sampleId)
        },
    })

    // Unsaved changes guard (Ctrl+S and beforeunload)
    useUnsavedChangesGuard({
        hasUnsavedChanges: editor.pendingCount > 0,
        onSave: editor.handleSave,
    })

    useEffect(() => {
        fetchTests()
    }, [fetchTests])

    // Fetch CoA status when sample is completed
    useEffect(() => {
        async function fetchCoA() {
            if (sampleStatus === 'completed') {
                const result = await getCoAStatus(sampleId)
                if (result.status) {
                    setCoaStatus(result.status)
                }
            }
        }
        fetchCoA()
    }, [sampleId, sampleStatus])

    // Fetch QC status for all assays when results change
    useEffect(() => {
        async function fetchQCStatus() {
            if (results.length === 0) return
            const assayIds = [...new Set(results.map(r => r.assay_id))]
            const qcResult = await getQCStatusForAssays(assayIds)
            if ('error' in qcResult) {
                console.error('Failed to fetch QC status:', qcResult.error)
                return
            }
            setQcStatuses(qcResult)
        }
        fetchQCStatus()
    }, [results])

    const handleGenerateCoA = async () => {
        setIsGeneratingCoA(true)
        try {
            const result = await regenerateCoA(sampleId)
            if (result.success) {
                toast.success('Đã tạo CoA thành công')
                setCoaStatus('ready')
            } else {
                toast.error(`Lỗi khi tạo CoA: ${result.error}`)
                setCoaStatus('failed')
            }
        } catch (err) {
            toast.error('Có lỗi không mong đợi khi tạo CoA')
            console.error(err)
        } finally {
            setIsGeneratingCoA(false)
        }
    }

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
                fetchTests()
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi gửi duyệt'
            toast.error(message)
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handlePrint = async () => {
        try {
            const sampleData = await fetchSampleDetail(sampleId)
            const currentDate = new Date().toLocaleDateString('vi-VN')
            const htmlContent = generatePrintTemplate(sampleData, results, currentDate)
            const printWindow = window.open('', '_blank')
            if (printWindow) {
                printWindow.document.write(htmlContent)
                printWindow.document.close()
                printWindow.onload = () => printWindow.print()
            } else {
                toast.error('Trình duyệt đã chặn cửa sổ in')
            }
        } catch (err) {
            console.error(err)
            toast.error('Có lỗi xảy ra khi in')
        }
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

    return (
        <div className="relative flex h-full flex-col">
            <AssignedTestsToolbar
                resultsCount={results.length}
                sampleId={sampleId}
                sampleStatus={sampleStatus}
                coaStatus={coaStatus}
                canSubmitForReview={allResultsEntered}
                hasPendingChanges={editor.pendingCount > 0}
                hasSignature={hasSignature}
                signatureLoading={signatureLoading}
                isGeneratingCoA={isGeneratingCoA}
                onPrint={handlePrint}
                onGenerateCoA={handleGenerateCoA}
                onSubmitForReview={() => setShowSubmitDialog(true)}
                onOpenAssignment={() => setShowAssignmentDialog(true)}
                userRole={userRole}
            />

            <div className="flex-1 overflow-auto bg-slate-50/50 p-4">
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
                                        <TableCell colSpan={6} className="h-32 text-center text-slate-500">
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
        </div>
    )
}
