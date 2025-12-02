'use client'

import { useEffect, useMemo, useState } from 'react'
import { assignTests, unassignTests, getSampleTests } from '@/app/actions/samples'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, Plus, Trash2, X, AlertCircle } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TestAssignmentSelector, type SelectedTest } from '@/components/test-assignment-selector'

// Types matching the backend response
type AssignedTest = SelectedTest

interface TestAssignmentDialogProps {
    sampleId: string
    sampleName: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function TestAssignmentDialog({
    sampleId,
    sampleName,
    open,
    onOpenChange,
    onSuccess,
}: TestAssignmentDialogProps) {
    // State
    const [currentlyAssigned, setCurrentlyAssigned] = useState<AssignedTest[]>([])
    const [toAdd, setToAdd] = useState<AssignedTest[]>([])
    const [toRemove, setToRemove] = useState<string[]>([]) // IDs of assigned tests (assayId) to remove

    // Loading states
    const [isInitialLoading, setIsInitialLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const disabledAssayIds = useMemo(
        () => currentlyAssigned.filter((a) => !toRemove.includes(a.assayId)).map((a) => a.assayId),
        [currentlyAssigned, toRemove]
    )

    // Initial load
    useEffect(() => {
        if (open) {
            loadInitialData()
            setToAdd([])
            setToRemove([])
            setSuccess(false)
            setError(null)
        }
    }, [open, sampleId])

    const loadInitialData = async () => {
        setIsInitialLoading(true)
        try {
            // Load currently assigned tests
            const testsResult = await getSampleTests(sampleId)
            if (testsResult.error) {
                setError(testsResult.error)
            } else {
                // Transform results to AssignedTest format
                const assigned =
                    testsResult.data?.map((r: any) => ({
                        assayId: r.assay.id,
                        methodId: r.assay.method?.id || '', // Should always have method
                        assayName: r.assay.name,
                        methodName: r.assay.method?.name || 'Chưa xác định',
                        units: r.assay.units,
                    })) || []
                setCurrentlyAssigned(assigned)
            }
        } catch (err) {
            setError('Failed to load data')
        } finally {
            setIsInitialLoading(false)
        }
    }

    const handleRemoveFromToAdd = (assayId: string) => {
        setToAdd(prev => prev.filter(a => a.assayId !== assayId))
    }

    const handleMarkForRemoval = (assayId: string) => {
        if (!toRemove.includes(assayId)) {
            setToRemove(prev => [...prev, assayId])
        }
    }

    const handleUnmarkForRemoval = (assayId: string) => {
        setToRemove(prev => prev.filter(id => id !== assayId))
    }

    const handleSubmit = async () => {
        if (toAdd.length === 0 && toRemove.length === 0) {
            onOpenChange(false)
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            // First, remove tests marked for removal
            if (toRemove.length > 0) {
                // Map to required structure for unassignTests
                const testsToRemove = toRemove.map(assayId => {
                    const assigned = currentlyAssigned.find(a => a.assayId === assayId)
                    return {
                        assayId,
                        methodId: assigned?.methodId || '00000000-0000-0000-0000-000000000000'
                    }
                })

                const removeResult = await unassignTests({
                    sampleId,
                    tests: testsToRemove,
                })
                if (removeResult.error) {
                    setError(removeResult.error)
                    setIsSubmitting(false)
                    return
                }
            }

            // Then, add new tests
            if (toAdd.length > 0) {
                const addResult = await assignTests({
                    sampleId,
                    tests: toAdd.map(t => ({
                        assayId: t.assayId,
                        methodId: t.methodId
                    }))
                })
                if (addResult.error) {
                    setError(addResult.error)
                    setIsSubmitting(false)
                    return
                }
            }

            // Success!
            setSuccess(true)
            setTimeout(() => {
                setSuccess(false)
                onOpenChange(false)
                onSuccess?.()
            }, 1500)
        } catch (err) {
            setError('Failed to update test assignments')
        } finally {
            setIsSubmitting(false)
        }
    }

    const hasChanges = toAdd.length > 0 || toRemove.length > 0
    const totalAfterChange = currentlyAssigned.length - toRemove.length + toAdd.length

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] sm:max-w-[98vw] w-full h-[95vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Chỉ định xét nghiệm</DialogTitle>
                    <DialogDescription>
                        Mẫu: <span className="font-medium text-foreground">{sampleName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/40">
                    <TestAssignmentSelector
                        selected={toAdd}
                        onChange={setToAdd}
                        disabledAssayIds={disabledAssayIds}
                        heading="Chọn xét nghiệm cần thêm (POS)"
                        subheading="Tìm kiếm, chọn phương pháp và đưa vào danh sách thêm mới. Các chỉ tiêu đã có sẽ bị khóa trừ khi bạn bỏ chọn ở danh sách bên dưới."
                    />

                    <div className="border rounded-lg bg-background">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Xét nghiệm đã chỉ định</h3>
                                <p className="text-xs text-muted-foreground">
                                    Bỏ chọn để hủy, số đếm cập nhật sau khi lưu.
                                </p>
                                {hasChanges && (
                                    <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                                        {toAdd.length > 0 && <span className="text-green-600">+{toAdd.length} thêm</span>}
                                        {toRemove.length > 0 && <span className="text-red-600">-{toRemove.length} xóa</span>}
                                    </div>
                                )}
                            </div>
                            <Badge variant="secondary">{totalAfterChange}</Badge>
                        </div>
                        <ScrollArea className="max-h-[360px]">
                            {isInitialLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : currentlyAssigned.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 py-10">
                                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
                                        <Plus className="h-5 w-5" />
                                    </div>
                                    <p className="text-sm">Chưa có xét nghiệm nào.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 p-4">
                                    {currentlyAssigned.map((test) => {
                                        const markedForRemoval = toRemove.includes(test.assayId)
                                        return (
                                            <div
                                                key={test.assayId}
                                                className={`flex items-start justify-between p-3 rounded-lg border group transition-all ${markedForRemoval
                                                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 opacity-70'
                                                    : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                                                    }`}
                                            >
                                                <div className="flex-1">
                                                    <div className={`font-medium text-sm ${markedForRemoval ? 'line-through' : ''}`}>
                                                        {test.assayName}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        <span className="font-medium">PP:</span> {test.methodName}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        markedForRemoval
                                                            ? handleUnmarkForRemoval(test.assayId)
                                                            : handleMarkForRemoval(test.assayId)
                                                    }
                                                    className={`p-1 transition-colors ${markedForRemoval
                                                        ? 'text-green-600 hover:text-green-700'
                                                        : 'text-muted-foreground hover:text-destructive'
                                                        }`}
                                                    title={markedForRemoval ? 'Hoàn tác' : 'Xóa'}
                                                >
                                                    {markedForRemoval ? (
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </ScrollArea>

                        {toAdd.length > 0 && (
                            <div className="border-t p-4 space-y-2">
                                <h4 className="text-xs font-semibold text-green-600 uppercase">
                                    Sẽ thêm ({toAdd.length})
                                </h4>
                                <div className="space-y-2">
                                    {toAdd.map((test) => (
                                        <div
                                            key={test.assayId}
                                            className="flex items-start justify-between p-3 rounded-lg border bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800 group"
                                        >
                                            <div>
                                                <div className="font-medium text-sm">{test.assayName}</div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    <span className="font-medium">PP:</span> {test.methodName}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveFromToAdd(test.assayId)}
                                                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                                title="Bỏ khỏi danh sách thêm"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t bg-background space-y-3">
                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Đã lưu thành công
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Hủy
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleSubmit}
                            disabled={!hasChanges || isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Lưu thay đổi'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
