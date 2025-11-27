'use client'

import { useState } from 'react'
import { assignTests, getAssayDefinitions, getSampleTests } from '@/app/actions/samples'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { type AssayWithMethod } from '@/types'
import { useEffect } from 'react'

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
    const [assays, setAssays] = useState<AssayWithMethod[]>([])
    const [selectedAssayIds, setSelectedAssayIds] = useState<string[]>([])
    const [assignedAssayIds, setAssignedAssayIds] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Load assays and existing assignments when dialog opens
    useEffect(() => {
        if (open) {
            loadData()
        }
    }, [open, sampleId])

    const loadData = async () => {
        setIsLoading(true)
        setError(null)

        // Load available assays
        const assaysResult = await getAssayDefinitions()
        if (assaysResult.error) {
            setError(assaysResult.error)
        } else {
            setAssays(assaysResult.data || [])
        }

        // Load already assigned tests
        const testsResult = await getSampleTests(sampleId)
        if (testsResult.error) {
            setError(testsResult.error)
        } else {
            const assignedIds = testsResult.data?.map((r: any) => r.assay_id) || []
            setAssignedAssayIds(assignedIds)
        }

        setIsLoading(false)
    }

    const handleToggleAssay = (assayId: string) => {
        setSelectedAssayIds((prev) =>
            prev.includes(assayId) ? prev.filter((id) => id !== assayId) : [...prev, assayId]
        )
    }

    const handleSubmit = async () => {
        if (selectedAssayIds.length === 0) {
            setError('Vui lòng chọn ít nhất một xét nghiệm')
            return
        }

        setIsSubmitting(true)
        setError(null)

        const result = await assignTests({
            sampleId,
            assayIds: selectedAssayIds,
        })

        if (result.error) {
            setError(result.error)
            setIsSubmitting(false)
        } else {
            setSuccess(true)
            setTimeout(() => {
                setSuccess(false)
                setSelectedAssayIds([])
                onOpenChange(false)
                onSuccess?.()
            }, 1500)
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Chỉ định xét nghiệm</DialogTitle>
                    <DialogDescription>
                        Chọn xét nghiệm để chỉ định cho mẫu: <strong>{sampleName}</strong>
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {assays.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4">
                                Không có xét nghiệm nào. Vui lòng tạo định nghĩa xét nghiệm trước.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {assays.map((assay) => {
                                    const isAssigned = assignedAssayIds.includes(assay.id)
                                    const isSelected = selectedAssayIds.includes(assay.id)

                                    return (
                                        <div
                                            key={assay.id}
                                            className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900"
                                        >
                                            <Checkbox
                                                id={assay.id}
                                                checked={isSelected}
                                                onCheckedChange={() => handleToggleAssay(assay.id)}
                                                disabled={isAssigned}
                                            />
                                            <div className="flex-1">
                                                <Label
                                                    htmlFor={assay.id}
                                                    className={`font-medium ${isAssigned
                                                        ? 'text-muted-foreground'
                                                        : 'cursor-pointer'
                                                        }`}
                                                >
                                                    {assay.name}
                                                    {isAssigned && (
                                                        <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                                            (Đã chỉ định)
                                                        </span>
                                                    )}
                                                </Label>
                                                {assay.units && (
                                                    <p className="text-sm text-muted-foreground">
                                                        Đơn vị: {assay.units}
                                                    </p>
                                                )}
                                                {assay.method_name && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Phương pháp: {assay.method_name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 p-3 rounded-md text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Đã chỉ định xét nghiệm thành công!
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Hủy
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || selectedAssayIds.length === 0}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang chỉ định...
                            </>
                        ) : (
                            `Chỉ định ${selectedAssayIds.length} xét nghiệm`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
