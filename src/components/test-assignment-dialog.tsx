'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, Search, Plus, Trash2, X } from 'lucide-react'
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
    const [selectedAssays, setSelectedAssays] = useState<AssayWithMethod[]>([])
    const [assignedAssayIds, setAssignedAssayIds] = useState<string[]>([])

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
            setSelectedAssays([])
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
            // Load assigned tests
            const testsResult = await getSampleTests(sampleId)
            if (testsResult.error) {
                setError(testsResult.error)
            } else {
                const assignedIds = testsResult.data?.map((r: any) => r.assay_id) || []
                setAssignedAssayIds(assignedIds)
            }

            // Load initial available assays (empty search)
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
        if (!selectedAssays.find(a => a.id === assay.id)) {
            setSelectedAssays(prev => [...prev, assay])
        }
    }

    const handleRemoveAssay = (assayId: string) => {
        setSelectedAssays(prev => prev.filter(a => a.id !== assayId))
    }

    const handleSubmit = async () => {
        if (selectedAssays.length === 0) return

        setIsSubmitting(true)
        setError(null)

        const result = await assignTests({
            sampleId,
            assayIds: selectedAssays.map(a => a.id),
        })

        if (result.error) {
            setError(result.error)
            setIsSubmitting(false)
        } else {
            setSuccess(true)
            setTimeout(() => {
                setSuccess(false)
                onOpenChange(false)
                onSuccess?.()
            }, 1500)
            setIsSubmitting(false)
        }
    }

    // Group available assays by method
    const groupedAssays = availableAssays.reduce((acc, assay) => {
        const method = assay.method_name || 'Khác' // 'Other' in Vietnamese
        if (!acc[method]) acc[method] = []
        acc[method].push(assay)
        return acc
    }, {} as Record<string, AssayWithMethod[]>)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
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
                                    // Filter out assays that are already assigned or selected
                                    const visibleAssays = assays.filter(
                                        a => !assignedAssayIds.includes(a.id) && !selectedAssays.find(s => s.id === a.id)
                                    )

                                    if (visibleAssays.length === 0) return null

                                    return (
                                        <div key={method} className="space-y-2">
                                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                                {method}
                                            </h4>
                                            <div className="grid grid-cols-1 gap-2">
                                                {visibleAssays.map(assay => (
                                                    <button
                                                        key={assay.id}
                                                        onClick={() => handleAddAssay(assay)}
                                                        className="flex items-center justify-between p-3 rounded-lg border bg-background hover:border-primary/50 hover:shadow-sm transition-all text-left group"
                                                    >
                                                        <div>
                                                            <div className="font-medium">{assay.name}</div>
                                                            {assay.units && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Đơn vị: {assay.units}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })
                            )}

                            {!isInitialLoading && !isSearching && availableAssays.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    Không tìm thấy xét nghiệm nào
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANE: Selected Tests */}
                    <div className="w-[350px] flex flex-col bg-background">
                        <div className="p-4 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                            <h3 className="font-semibold">Đã chọn</h3>
                            <Badge variant="secondary">{selectedAssays.length}</Badge>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {selectedAssays.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50">
                                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <p className="text-sm">Chọn xét nghiệm từ danh sách</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedAssays.map((assay) => (
                                        <div
                                            key={assay.id}
                                            className="flex items-start justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 group"
                                        >
                                            <div>
                                                <div className="font-medium text-sm">{assay.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {assay.method_name || 'Không có phương pháp'}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveAssay(assay.id)}
                                                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 space-y-4">
                            {error && (
                                <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                                    {error}
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
                                    disabled={selectedAssays.length === 0 || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        'Lưu chỉ định'
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
