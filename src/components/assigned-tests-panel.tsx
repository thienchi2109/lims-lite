'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys } from '@/types/query-keys'
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
import { Badge } from '@/components/ui/badge'
import {
    Loader2,
    Plus,
    FlaskConical,
    CheckCircle,
    Printer,
    AlertCircle,
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    fetchSampleResultsClient,
    saveBatchResultsClient,
    submitSampleForReviewClient,
} from '@/lib/api-client'
import { fetchSampleDetail } from '@/hooks/use-sample-detail'
import { validateNumericValue, validateTextValue } from '@/lib/utils-lims'
import { ResultWithAssay, SampleStatus, type LabSpecialty } from '@/types'
import { ResultCellEditor } from '@/components/result-cell-editor'
import { BatchSaveToolbar } from '@/components/batch-save-toolbar'
import { ResultStatusBadge } from '@/components/result-status-badge'
import { toast } from 'sonner'
import { TestAssignmentModule } from '@/components/test-assignment-module'
import { generatePrintTemplate } from '@/lib/print-template'

interface AssignedTestsPanelProps {
    sampleId: string
    specialties?: LabSpecialty[]
}

export function AssignedTestsPanel({ sampleId, specialties = [] }: AssignedTestsPanelProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const [results, setResults] = useState<ResultWithAssay[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Inline editing state
    const [resultValues, setResultValues] = useState<Record<string, string>>({})
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [isSaving, setIsSaving] = useState(false)
    const [sampleStatus, setSampleStatus] = useState<SampleStatus | null>(null)

    // Submit for review state
    const [showSubmitDialog, setShowSubmitDialog] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Test assignment state
    const [showAssignmentDialog, setShowAssignmentDialog] = useState(false)

    const fetchTests = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error } = await fetchSampleResultsClient(sampleId)
            if (error) {
                setError(error)
            } else if (data) {
                setResults(data)
                // Set sample status from the first result (all results belong to same sample)
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

    useEffect(() => {
        fetchTests()
    }, [fetchTests])

    // Determine if editing is allowed based on sample status
    const isEditable = useCallback(() => {
        if (!sampleStatus) return false
        // Editable statuses: assigned, in_progress
        // Review status is NOT editable for analysts (and generally locked until rejected)
        return ['assigned', 'in_progress'].includes(sampleStatus)
    }, [sampleStatus])

    // Handle value changes from ResultCellEditor
    const handleValueChange = useCallback(async (resultId: string, value: string) => {
        setResultValues((prev) => ({
            ...prev,
            [resultId]: value,
        }))

        // Validate immediately
        const result = results.find((r) => r.id === resultId)
        if (result) {
            const rules = result.validation_rules || {}
            const error = await validateResultValue(value, rules)

            setValidationErrors((prev) => {
                const next = { ...prev }
                if (error) {
                    next[resultId] = error
                } else {
                    delete next[resultId]
                }
                return next
            })
        }
    }, [results])

    const handleSave = async () => {
        if (Object.keys(validationErrors).length > 0) {
            toast.error('Vui lòng sửa các lỗi trước khi lưu')
            return
        }

        setIsSaving(true)
        try {
            const updates = Object.entries(resultValues).map(([id, value]) => ({
                id,
                value,
            }))

            const result = await saveBatchResultsClient({ results: updates })

            if (result.error) {
                toast.error(result.error)
                if (result.validationErrors) {
                    // Update validation errors from server
                    const serverErrors: Record<string, string> = {}
                    result.validationErrors.forEach((err: any) => {
                        serverErrors[err.id] = err.error
                    })
                    setValidationErrors(serverErrors)
                }
            } else {
                toast.success('Đã lưu kết quả thành công')
                setResultValues({})
                setValidationErrors({})
                fetchTests() // Refresh data
                queryClient.invalidateQueries({ queryKey: sampleKeys.detail(sampleId) }) // Refresh sample status

                // Refresh sample list and move to top (sort by updated_at)
                handleRefocus(sampleId)
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra khi lưu kết quả')
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDiscard = () => {
        setResultValues({})
        setValidationErrors({})
        toast.info('Đã hủy các thay đổi')
    }

    const handleSubmitForReview = async () => {
        setIsSubmitting(true)
        try {
            const result = await submitSampleForReviewClient(sampleId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Đã gửi mẫu để duyệt')
                setShowSubmitDialog(false)

                // Invalidate queries to trigger refetch
                queryClient.invalidateQueries({ queryKey: sampleKeys.all }) // Refresh sample list
                queryClient.invalidateQueries({ queryKey: sampleKeys.detail(sampleId) }) // Force refresh detail panel

                fetchTests() // Refresh to update status
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra khi gửi duyệt')
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handlePrint = async () => {
        try {
            // Fetch full sample details
            const sampleData = await fetchSampleDetail(sampleId)

            // Generate HTML
            const htmlContent = generatePrintTemplate(sampleData, results)

            // Open print window
            const printWindow = window.open('', '_blank')
            if (printWindow) {
                printWindow.document.write(htmlContent)
                printWindow.document.close()
                // Wait for resources to load then print
                printWindow.onload = () => {
                    printWindow.print()
                }
            } else {
                toast.error('Trình duyệt đã chặn cửa sổ in')
            }
        } catch (error) {
            console.error(error)
            toast.error('Có lỗi xảy ra khi in')
        }
    }

    const handleRefocus = (targetSampleId: string) => {
        // Navigate to the samples page with updated_at sorting, focus on the sample, and reset to first page
        const params = new URLSearchParams(searchParams?.toString() ?? '')
        params.set('sortBy', 'updated_at')
        params.set('sortOrder', 'desc')
        params.set('sampleId', targetSampleId)
        params.set('page', '1')
        router.push(`?${params.toString()}`)

        // Invalidate queries to trigger refetch with new cache
        queryClient.invalidateQueries({ queryKey: sampleKeys.all })
    }

    // Keyboard shortcut for save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                if (Object.keys(resultValues).length > 0) {
                    handleSave()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [resultValues, validationErrors])

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (Object.keys(resultValues).length > 0) {
                e.preventDefault()
                e.returnValue = ''
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [resultValues])

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

    const pendingCount = Object.keys(resultValues).length
    const canEdit = isEditable()

    // Check if all results have values to enable submit button
    const allResultsEntered = results.length > 0 && results.every(r => {
        // Use edited value if available, otherwise original value
        const val = resultValues[r.id] !== undefined ? resultValues[r.id] : r.value
        return val !== null && val !== ''
    })

    return (
        <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-slate-700">Chỉ định xét nghiệm</h3>
                    <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600 hover:bg-slate-200">
                        {results.length}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    {/* Test Order Form Print Button - Available for all samples */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                        disabled={results.length === 0}
                        onClick={handlePrint}
                    >
                        <Printer className="h-4 w-4" />
                        Xuất Phiếu
                    </Button>

                    {/* Submit for Review Button */}
                    {sampleStatus === 'in_progress' && allResultsEntered && (
                        <Button
                            size="sm"
                            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => setShowSubmitDialog(true)}
                            disabled={pendingCount > 0} // Disable if there are unsaved changes
                        >
                            <CheckCircle className="h-4 w-4" />
                            Gửi duyệt
                        </Button>
                    )}

                    <Button
                        size="sm"
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => setShowAssignmentDialog(true)}
                    >
                        <Plus className="h-4 w-4" />
                        Chỉ định
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50/50 p-4">
                <Card className="border-slate-200 shadow-sm">
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
                                    results.map((result) => (
                                        <TableRow key={result.id} className="group hover:bg-slate-50/50">
                                            <TableCell className="font-medium text-slate-700">
                                                {result.assay_name}
                                            </TableCell>
                                            <TableCell className="text-slate-600">
                                                {result.method_name || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <ResultCellEditor
                                                    value={resultValues[result.id] ?? result.value ?? ''}
                                                    onChange={(val) => handleValueChange(result.id, val)}
                                                    isEditable={canEdit && result.status !== 'approved'}
                                                    validationError={validationErrors[result.id]}
                                                    isPending={resultValues[result.id] !== undefined}
                                                />
                                            </TableCell>
                                            <TableCell className="text-slate-500">
                                                {result.assay_units || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <ResultStatusBadge status={result.status} />
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500">
                                                {result.entered_by_name ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-slate-700">
                                                            {result.entered_by_name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {result.entered_at
                                                                ? new Date(result.entered_at).toLocaleDateString('vi-VN')
                                                                : '-'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <BatchSaveToolbar
                pendingCount={pendingCount}
                onSave={handleSave}
                onDiscard={handleDiscard}
                isSaving={isSaving}
                isVisible={pendingCount > 0}
            />

            <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận gửi duyệt</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn gửi mẫu này để duyệt không? Trạng thái mẫu sẽ chuyển sang "Chờ duyệt" và bạn sẽ không thể chỉnh sửa kết quả cho đến khi quản lý phản hồi.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={isSubmitting}>
                            Hủy
                        </Button>
                        <Button onClick={handleSubmitForReview} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                            {isSubmitting ? (
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
                <DialogContent className="max-w-[90vw] p-0 overflow-hidden border-none bg-transparent shadow-none sm:max-w-[1200px]">
                    <DialogTitle className="sr-only">Chỉ định xét nghiệm</DialogTitle>
                    <DialogDescription className="sr-only">
                        Chọn các xét nghiệm cần chỉ định cho mẫu này
                    </DialogDescription>
                    <TestAssignmentModule
                        sampleId={sampleId}
                        sampleStatus={sampleStatus}
                        onClose={() => setShowAssignmentDialog(false)}
                        onSuccess={() => {
                            fetchTests()
                        }}
                        onRefocus={handleRefocus}
                        specialties={specialties}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}

async function validateResultValue(value: string, rules: Record<string, any>) {
    const normalizedRules = rules || {}
    if (
        normalizedRules.type === 'numeric' ||
        normalizedRules.min !== undefined ||
        normalizedRules.max !== undefined
    ) {
        return validateNumericValue(value, normalizedRules)
    }

    return validateTextValue(value, normalizedRules)
}
