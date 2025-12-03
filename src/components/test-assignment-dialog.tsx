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
import { TestAssignmentGrid, type SelectedTest } from '@/components/test-assignment-grid'

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
    const [initialTests, setInitialTests] = useState<AssignedTest[]>([])
    const [selectedTests, setSelectedTests] = useState<AssignedTest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initial load
    useEffect(() => {
        if (open) {
            loadInitialData()
        }
    }, [open, sampleId])

    const loadInitialData = async () => {
        setIsLoading(true)
        try {
            const testsResult = await getSampleTests(sampleId)
            if (testsResult.error) {
                setError(testsResult.error)
            } else {
                const assigned = testsResult.data?.map((r: any) => ({
                    assayId: r.assay.id,
                    methodId: r.assay.method?.id || '',
                    assayName: r.assay.name,
                    methodName: r.assay.method?.name || 'Chưa xác định',
                    units: r.assay.units,
                })) || []
                setInitialTests(assigned)
                setSelectedTests(assigned)
            }
        } catch (err) {
            setError('Failed to load data')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        setIsSubmitting(true)
        setError(null)

        try {
            // Calculate diffs
            const initialIds = new Set(initialTests.map(t => t.assayId))
            const selectedIds = new Set(selectedTests.map(t => t.assayId))

            const toAdd = selectedTests.filter(t => !initialIds.has(t.assayId))
            const toRemove = initialTests.filter(t => !selectedIds.has(t.assayId))

            // 1. Remove tests
            if (toRemove.length > 0) {
                const removeResult = await unassignTests({
                    sampleId,
                    tests: toRemove.map(t => ({
                        assayId: t.assayId,
                        methodId: t.methodId
                    }))
                })
                if (removeResult.error) throw new Error(removeResult.error)
            }

            // 2. Add tests
            if (toAdd.length > 0) {
                const addResult = await assignTests({
                    sampleId,
                    tests: toAdd.map(t => ({
                        assayId: t.assayId,
                        methodId: t.methodId
                    }))
                })
                if (addResult.error) throw new Error(addResult.error)
            }

            // 3. Update methods for existing tests if changed
            const toUpdateMethod = selectedTests.filter(t => {
                const initial = initialTests.find(i => i.assayId === t.assayId)
                return initial && initial.methodId !== t.methodId
            })

            if (toUpdateMethod.length > 0) {
                const updateRemoveResult = await unassignTests({
                    sampleId,
                    tests: toUpdateMethod.map(t => {
                        const initial = initialTests.find(i => i.assayId === t.assayId)
                        return {
                            assayId: t.assayId,
                            methodId: initial!.methodId
                        }
                    })
                })
                if (updateRemoveResult.error) throw new Error(updateRemoveResult.error)

                const updateAddResult = await assignTests({
                    sampleId,
                    tests: toUpdateMethod.map(t => ({
                        assayId: t.assayId,
                        methodId: t.methodId
                    }))
                })
                if (updateAddResult.error) throw new Error(updateAddResult.error)
            }

            onSuccess?.()
            onOpenChange(false)

        } catch (err: any) {
            setError(err.message || 'Failed to update assignments')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] sm:max-w-[98vw] w-full h-[95vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b hidden">
                    <DialogTitle>Chỉ định xét nghiệm</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <TestAssignmentGrid
                            selected={selectedTests}
                            onChange={setSelectedTests}
                            onSave={handleSave}
                            isSaving={isSubmitting}
                            context={
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mã mẫu</label>
                                        <div className="text-lg font-mono font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                                            {sampleName}
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-destructive/10 rounded text-sm text-destructive">
                                            {error}
                                        </div>
                                    )}

                                    <div className="pt-4">
                                        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                                            Đóng
                                        </Button>
                                    </div>
                                </div>
                            }
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
