'use client'

import { useState, useEffect } from 'react'
import { assignTests, unassignTests, getSampleTests } from '@/app/actions/samples'
import { getAssayDefinitions } from '@/app/actions/assays'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, Search, Plus, Trash2, X, AlertCircle, ArrowLeft, Beaker } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

// Types matching the backend response
type AssayMethod = {
    id: string
    method_id: string
    name: string
    is_default: boolean
    notes: string | null
}

type AssayDefinitionWithMethods = {
    id: string
    name: string
    units: string | null
    methods: AssayMethod[]
}

type AssignedTest = {
    assayId: string
    methodId: string
    assayName: string
    methodName: string
    units: string | null
}

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
    const [searchTerm, setSearchTerm] = useState('')
    const [availableAssays, setAvailableAssays] = useState<AssayDefinitionWithMethods[]>([])

    // Selection State
    const [currentlyAssigned, setCurrentlyAssigned] = useState<AssignedTest[]>([])
    const [toAdd, setToAdd] = useState<AssignedTest[]>([])
    const [toRemove, setToRemove] = useState<string[]>([]) // IDs of assigned tests (assayId) to remove

    // Drill-down State for Method Selection
    const [selectedAssayForMethod, setSelectedAssayForMethod] = useState<AssayDefinitionWithMethods | null>(null)

    // Loading states
    const [isInitialLoading, setIsInitialLoading] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Initial load
    useEffect(() => {
        if (open) {
            loadInitialData()
            setSearchTerm('')
            setToAdd([])
            setToRemove([])
            setSuccess(false)
            setError(null)
            setSelectedAssayForMethod(null)
        }
    }, [open, sampleId])

    // Debounced search
    useEffect(() => {
        if (!open) return

        const timer = setTimeout(() => {
            handleSearch(searchTerm)
        }, 300)

        return () => clearTimeout(timer)
    }, [searchTerm, open])

    const loadInitialData = async () => {
        setIsInitialLoading(true)
        try {
            // Load currently assigned tests
            const testsResult = await getSampleTests(sampleId)
            if (testsResult.error) {
                setError(testsResult.error)
            } else {
                // Transform results to AssignedTest format
                const assigned = testsResult.data?.map((r: any) => ({
                    assayId: r.assay.id,
                    methodId: r.assay.method?.id || '', // Should always have method
                    assayName: r.assay.name,
                    methodName: r.assay.method?.name || 'Chưa xác định',
                    units: r.assay.units,
                })) || []
                setCurrentlyAssigned(assigned)
            }

            // Load all available assays
            await handleSearch('')
        } catch (err) {
            setError('Failed to load data')
        } finally {
            setIsInitialLoading(false)
        }
    }

    const handleSearch = async (term: string) => {
        setIsSearching(true)
        try {
            const result = await getAssayDefinitions({ search: term, pageSize: 100 }) // Fetch more for better UX
            if (result.error) {
                console.error(result.error)
            } else {
                setAvailableAssays(result.data as unknown as AssayDefinitionWithMethods[])
            }
        } catch (err) {
            console.error('Search failed', err)
        } finally {
            setIsSearching(false)
        }
    }

    const handleAssayClick = (assay: AssayDefinitionWithMethods) => {
        // Check if already added or assigned
        const isAssigned = currentlyAssigned.some(a => a.assayId === assay.id && !toRemove.includes(a.assayId))
        const isAdded = toAdd.some(a => a.assayId === assay.id)

        if (isAssigned || isAdded) return // Already handled

        if (assay.methods && assay.methods.length > 1) {
            // Multiple methods: Show selection view
            setSelectedAssayForMethod(assay)
        } else if (assay.methods && assay.methods.length === 1) {
            // Single method: Add directly
            const method = assay.methods[0]
            handleAddTest({
                assayId: assay.id,
                methodId: method.method_id, // Note: method_id from junction table
                assayName: assay.name,
                methodName: method.name,
                units: assay.units
            })
        } else {
            // No methods: Cannot add (should not happen ideally)
            setError(`Chỉ tiêu "${assay.name}" chưa có phương pháp nào. Vui lòng cập nhật cấu hình.`)
        }
    }

    const handleAddTest = (test: AssignedTest) => {
        if (!toAdd.find(a => a.assayId === test.assayId)) {
            setToAdd(prev => [...prev, test])
        }
        // Reset selection view if open
        setSelectedAssayForMethod(null)
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] sm:max-w-[98vw] w-full h-[95vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Chỉ định xét nghiệm</DialogTitle>
                    <DialogDescription>
                        Mẫu: <span className="font-medium text-foreground">{sampleName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT PANE: Available Tests */}
                    <div className="flex-1 flex flex-col border-r bg-slate-50/50 dark:bg-slate-900/50">
                        {selectedAssayForMethod ? (
                            // METHOD SELECTION VIEW
                            <div className="flex flex-col h-full">
                                <div className="p-4 border-b bg-background flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedAssayForMethod(null)}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <h3 className="font-semibold">{selectedAssayForMethod.name}</h3>
                                        <p className="text-xs text-muted-foreground">Chọn phương pháp xét nghiệm</p>
                                    </div>
                                </div>
                                <ScrollArea className="flex-1 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {selectedAssayForMethod.methods.map(method => (
                                            <button
                                                key={method.id}
                                                onClick={() => handleAddTest({
                                                    assayId: selectedAssayForMethod.id,
                                                    methodId: method.method_id,
                                                    assayName: selectedAssayForMethod.name,
                                                    methodName: method.name,
                                                    units: selectedAssayForMethod.units
                                                })}
                                                className="flex flex-col items-start p-4 rounded-lg border bg-background hover:border-primary hover:shadow-md transition-all text-left group"
                                            >
                                                <div className="flex items-center justify-between w-full mb-2">
                                                    <span className="font-medium">{method.name}</span>
                                                    {method.is_default && (
                                                        <Badge variant="secondary" className="text-[10px]">Mặc định</Badge>
                                                    )}
                                                </div>
                                                {method.notes && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2">{method.notes}</p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        ) : (
                            // ASSAY LIST VIEW
                            <div className="flex flex-col h-full">
                                <div className="p-4 border-b bg-background">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Tìm kiếm chỉ tiêu..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 p-4">
                                    {isInitialLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                            {availableAssays.map(assay => {
                                                const isAssigned = currentlyAssigned.some(a => a.assayId === assay.id && !toRemove.includes(a.assayId))
                                                const isAdded = toAdd.some(a => a.assayId === assay.id)
                                                const isDisabled = isAssigned || isAdded

                                                return (
                                                    <button
                                                        key={assay.id}
                                                        onClick={() => handleAssayClick(assay)}
                                                        disabled={isDisabled}
                                                        className={`flex flex-col items-start justify-between p-3 rounded-lg border transition-all text-left group h-full min-h-[80px] relative overflow-hidden
                                                            ${isDisabled
                                                                ? 'bg-slate-100 dark:bg-slate-800 opacity-60 cursor-not-allowed'
                                                                : 'bg-background hover:border-primary hover:shadow-md'
                                                            }`}
                                                    >
                                                        <div className="space-y-1 w-full">
                                                            <div className="font-medium text-sm line-clamp-2 pr-4">{assay.name}</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {assay.units && (
                                                                    <div className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-md w-fit">
                                                                        {assay.units}
                                                                    </div>
                                                                )}
                                                                {assay.methods && assay.methods.length > 1 && (
                                                                    <div className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-md w-fit flex items-center gap-1">
                                                                        <Beaker className="h-3 w-3" />
                                                                        {assay.methods.length} phương pháp
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isDisabled && (
                                                            <div className="absolute top-2 right-2">
                                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })}

                                            {!isInitialLoading && !isSearching && availableAssays.length === 0 && (
                                                <div className="col-span-full text-center py-8 text-muted-foreground">
                                                    Không tìm thấy chỉ tiêu nào
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        )}
                    </div>

                    {/* RIGHT PANE: Currently Assigned & To Add */}
                    <div className="w-[400px] flex flex-col bg-background border-l">
                        {/* Header with change summary */}
                        <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Đã chọn</h3>
                                <Badge variant="secondary">
                                    {currentlyAssigned.length - toRemove.length + toAdd.length}
                                </Badge>
                            </div>
                            {hasChanges && (
                                <div className="text-xs text-muted-foreground flex gap-3">
                                    {toAdd.length > 0 && <span className="text-green-600">+{toAdd.length} thêm</span>}
                                    {toRemove.length > 0 && <span className="text-red-600">-{toRemove.length} xóa</span>}
                                </div>
                            )}
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4">
                                {/* Currently Assigned Tests */}
                                {currentlyAssigned.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                                            Đã chỉ định ({currentlyAssigned.length})
                                        </h4>
                                        <div className="space-y-2">
                                            {currentlyAssigned.map((test) => {
                                                const markedForRemoval = toRemove.includes(test.assayId)
                                                return (
                                                    <div
                                                        key={test.assayId}
                                                        className={`flex items-start justify-between p-3 rounded-lg border group transition-all ${markedForRemoval
                                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 opacity-50'
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
                                    </div>
                                )}

                                {/* Tests to Add */}
                                {toAdd.length > 0 && (
                                    <div className="space-y-2">
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
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Empty state */}
                                {currentlyAssigned.length === 0 && toAdd.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50 py-8">
                                        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
                                            <Plus className="h-6 w-6" />
                                        </div>
                                        <p className="text-sm">Chọn xét nghiệm từ danh sách</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Footer Actions */}
                        <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 space-y-4">
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
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
