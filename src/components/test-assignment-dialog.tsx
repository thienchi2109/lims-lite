'use client'

import { useState, useEffect } from 'react'
import { assignTests, unassignTests, getAssayDefinitions, getSampleTests } from '@/app/actions/samples'
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
import { Loader2, CheckCircle2, Search, Plus, Trash2, X, AlertCircle } from 'lucide-react'
import { type AssayWithMethod } from '@/types'

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
    const [availableAssays, setAvailableAssays] = useState<AssayWithMethod[]>([])
    const [currentlyAssigned, setCurrentlyAssigned] = useState<AssayWithMethod[]>([])
    const [toAdd, setToAdd] = useState<AssayWithMethod[]>([])
    const [toRemove, setToRemove] = useState<string[]>([]) // IDs of assigned tests to remove

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
                // Transform results to AssayWithMethod format
                const assigned = testsResult.data?.map((r: any) => ({
                    id: r.assay.id,
                    name: r.assay.name,
                    units: r.assay.units,
                    method_id: r.assay.method?.id || null,
                    method_name: r.assay.method?.name || null,
                    validation_rules: {},
                    created_at: '',
                    updated_at: '',
                    deleted_at: null,
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
            const result = await getAssayDefinitions(term)
            if (result.error) {
                console.error(result.error)
            } else {
                setAvailableAssays(result.data || [])
            }
        } catch (err) {
            console.error('Search failed', err)
        } finally {
            setIsSearching(false)
        }
    }

    const handleAddAssay = (assay: AssayWithMethod) => {
        if (!toAdd.find(a => a.id === assay.id)) {
            setToAdd(prev => [...prev, assay])
        }
    }

    const handleRemoveFromToAdd = (assayId: string) => {
        setToAdd(prev => prev.filter(a => a.id !== assayId))
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
                const removeResult = await unassignTests({
                    sampleId,
                    assayIds: toRemove,
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
                    assayIds: toAdd.map(a => a.id),
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

    // Filter available assays: exclude currently assigned (unless marked for removal) and already in toAdd
    const filteredAvailableAssays = availableAssays.filter(assay => {
        const isCurrentlyAssigned = currentlyAssigned.find(a => a.id === assay.id)
        const isMarkedForRemoval = toRemove.includes(assay.id)
        const isInToAdd = toAdd.find(a => a.id === assay.id)

        // Show if: not currently assigned OR marked for removal, AND not in toAdd
        return (!isCurrentlyAssigned || isMarkedForRemoval) && !isInToAdd
    })

    // Group available assays by method
    const groupedAssays = filteredAvailableAssays.reduce((acc, assay) => {
        const method = assay.method_name || 'Khác'
        if (!acc[method]) acc[method] = []
        acc[method].push(assay)
        return acc
    }, {} as Record<string, AssayWithMethod[]>)

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
                        <div className="p-4 border-b bg-background">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Tìm kiếm xét nghiệm hoặc phương pháp..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {isInitialLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                Object.entries(groupedAssays).map(([method, assays]) => {
                                    if (assays.length === 0) return null

                                    return (
                                        <div key={method} className="space-y-2">
                                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
                                                <div className="h-px flex-1 bg-border"></div>
                                                {method}
                                                <div className="h-px flex-1 bg-border"></div>
                                            </h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                                {assays.map(assay => (
                                                    <button
                                                        key={assay.id}
                                                        onClick={() => handleAddAssay(assay)}
                                                        className="flex flex-col items-start justify-between p-3 rounded-lg border bg-background hover:border-primary hover:shadow-md transition-all text-left group h-full min-h-[80px] relative overflow-hidden"
                                                    >
                                                        <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <div className="bg-primary/10 p-0.5 rounded-full">
                                                                <Plus className="h-3 w-3 text-primary" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 w-full">
                                                            <div className="font-medium text-sm line-clamp-2 pr-4">{assay.name}</div>
                                                            {assay.units && (
                                                                <div className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-md w-fit">
                                                                    {assay.units}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })
                            )}

                            {!isInitialLoading && !isSearching && Object.keys(groupedAssays).length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    Không tìm thấy xét nghiệm nào
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANE: Currently Assigned & To Add */}
                    <div className="w-[400px] flex flex-col bg-background">
                        {/* Header with change summary */}
                        <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Xét nghiệm đã chọn</h3>
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

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Currently Assigned Tests */}
                            {currentlyAssigned.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                                        Đã chỉ định ({currentlyAssigned.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {currentlyAssigned.map((assay) => {
                                            const markedForRemoval = toRemove.includes(assay.id)
                                            return (
                                                <div
                                                    key={assay.id}
                                                    className={`flex items-start justify-between p-3 rounded-lg border group transition-all ${markedForRemoval
                                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 opacity-50'
                                                        : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                                                        }`}
                                                >
                                                    <div className="flex-1">
                                                        <div className={`font-medium text-sm ${markedForRemoval ? 'line-through' : ''}`}>
                                                            {assay.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {assay.method_name || 'Không có phương pháp'}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            markedForRemoval
                                                                ? handleUnmarkForRemoval(assay.id)
                                                                : handleMarkForRemoval(assay.id)
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
                                        {toAdd.map((assay) => (
                                            <div
                                                key={assay.id}
                                                className="flex items-start justify-between p-3 rounded-lg border bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800 group"
                                            >
                                                <div>
                                                    <div className="font-medium text-sm">{assay.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {assay.method_name || 'Không có phương pháp'}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveFromToAdd(assay.id)}
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
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50">
                                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <p className="text-sm">Chọn xét nghiệm từ danh sách</p>
                                </div>
                            )}
                        </div>

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
