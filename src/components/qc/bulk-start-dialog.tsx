'use client'

import { useState, useMemo } from 'react'
import { bulkStartQCSessions, type BulkStartResult } from '@/app/actions/qc-bulk-operations'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Loader2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { QCSessionMode } from '@/types/qc'

interface AssayOption {
    id: string
    name: string
}

interface BulkStartSessionDialogProps {
    assays: AssayOption[]
    onSuccess?: () => void
    trigger?: React.ReactNode
}

export function BulkStartSessionDialog({
    assays,
    onSuccess,
    trigger,
}: BulkStartSessionDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [sessionMode, setSessionMode] = useState<QCSessionMode>('daily')
    const [notes, setNotes] = useState('')
    const [search, setSearch] = useState('')
    const [result, setResult] = useState<BulkStartResult | null>(null)

    const filteredAssays = useMemo(() => {
        if (!search.trim()) return assays
        const term = search.toLowerCase()
        return assays.filter(a => a.name.toLowerCase().includes(term))
    }, [assays, search])

    const toggleAssay = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const toggleAll = () => {
        if (selectedIds.size === filteredAssays.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredAssays.map(a => a.id)))
        }
    }

    const handleSubmit = async () => {
        if (selectedIds.size === 0) {
            toast.error('Vui lòng chọn ít nhất một xét nghiệm')
            return
        }

        setIsSubmitting(true)
        setResult(null)

        try {
            const response = await bulkStartQCSessions({
                assay_ids: Array.from(selectedIds),
                session_mode: sessionMode,
                notes: notes || undefined,
            })

            if ('error' in response && response.error) {
                toast.error(response.error)
                return
            }

            if (response.data) {
                setResult(response.data)
                const { success, failed } = response.data

                if (success.length > 0 && failed.length === 0) {
                    toast.success(`Đã bắt đầu ${success.length} phiên QC`)
                    handleClose()
                    onSuccess?.()
                } else if (success.length > 0 && failed.length > 0) {
                    toast.warning(`${success.length} thành công, ${failed.length} thất bại`)
                } else {
                    toast.error(`Không thể bắt đầu ${failed.length} phiên`)
                }
            }
        } catch (error) {
            toast.error('Không thể bắt đầu các phiên QC')
            console.error('Bulk start error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setIsOpen(false)
        setSelectedIds(new Set())
        setSessionMode('daily')
        setNotes('')
        setSearch('')
        setResult(null)
    }

    return (
        <Dialog open={isOpen} onOpenChange={open => open ? setIsOpen(true) : handleClose()}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Bắt đầu nhiều phiên
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Bắt đầu nhiều phiên QC</DialogTitle>
                    <DialogDescription>
                        Chọn các xét nghiệm cần bắt đầu phiên QC cùng lúc.
                    </DialogDescription>
                </DialogHeader>

                {result ? (
                    <ResultSummary result={result} onClose={handleClose} onSuccess={onSuccess} />
                ) : (
                    <>
                        <div className="space-y-4 py-2">
                            {/* Session Mode */}
                            <div className="space-y-2">
                                <Label>Chế độ phiên</Label>
                                <Select
                                    value={sessionMode}
                                    onValueChange={(v) => setSessionMode(v as QCSessionMode)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Hàng ngày</SelectItem>
                                        <SelectItem value="batch">Theo lô</SelectItem>
                                        <SelectItem value="shift">Theo ca</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Tìm xét nghiệm..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            {/* Assay List */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Xét nghiệm ({selectedIds.size}/{assays.length})</Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={toggleAll}
                                        className="h-7 text-xs"
                                    >
                                        {selectedIds.size === filteredAssays.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                    </Button>
                                </div>
                                <ScrollArea className="h-48 rounded-md border p-2">
                                    <div className="space-y-1">
                                        {filteredAssays.map(assay => (
                                            <label
                                                key={assay.id}
                                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                            >
                                                <Checkbox
                                                    checked={selectedIds.has(assay.id)}
                                                    onCheckedChange={() => toggleAssay(assay.id)}
                                                />
                                                <span className="text-sm">{assay.name}</span>
                                            </label>
                                        ))}
                                        {filteredAssays.length === 0 && (
                                            <p className="text-sm text-muted-foreground p-2">
                                                Không tìm thấy xét nghiệm
                                            </p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label>Ghi chú (tùy chọn)</Label>
                                <Textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Ghi chú chung cho các phiên..."
                                    rows={2}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleClose}>
                                Hủy
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || selectedIds.size === 0}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Đang xử lý...
                                    </>
                                ) : (
                                    `Bắt đầu ${selectedIds.size} phiên`
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

function ResultSummary({
    result,
    onClose,
    onSuccess,
}: {
    result: BulkStartResult
    onClose: () => void
    onSuccess?: () => void
}) {
    const handleDone = () => {
        onClose()
        onSuccess?.()
    }

    return (
        <div className="space-y-4 py-2">
            {result.success.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Thành công ({result.success.length})</span>
                    </div>
                    <ScrollArea className="h-24 rounded-md border p-2">
                        {result.success.map(s => (
                            <p key={s.session_id} className="text-sm py-0.5">
                                {s.assay_name || s.assay_id}
                            </p>
                        ))}
                    </ScrollArea>
                </div>
            )}

            {result.failed.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">Thất bại ({result.failed.length})</span>
                    </div>
                    <ScrollArea className="h-24 rounded-md border p-2">
                        {result.failed.map(f => (
                            <p key={f.assay_id} className="text-sm py-0.5">
                                {f.assay_name || f.assay_id}: {f.error}
                            </p>
                        ))}
                    </ScrollArea>
                </div>
            )}

            <DialogFooter>
                <Button onClick={handleDone}>Hoàn tất</Button>
            </DialogFooter>
        </div>
    )
}
