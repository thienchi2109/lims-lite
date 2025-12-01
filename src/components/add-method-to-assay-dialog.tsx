'use client'

import { useEffect, useState, useTransition } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { addMethodToAssay } from '@/app/actions/assay-methods'
import { getMethods } from '@/app/actions/assays'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type Method = {
    id: string
    name: string
    description: string | null
}

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    assayId: string
    existingMethodIds: string[]
}

export function AddMethodToAssayDialog({ open, onOpenChange, assayId, existingMethodIds }: Props) {
    const [isPending, startTransition] = useTransition()
    const [methods, setMethods] = useState<Method[]>([])
    const [loadingMethods, setLoadingMethods] = useState(true)

    // Form state
    const [methodId, setMethodId] = useState<string>('')
    const [isDefault, setIsDefault] = useState(false)
    const [notes, setNotes] = useState('')

    // Load methods on open
    useEffect(() => {
        if (open) {
            loadMethods()
        }
    }, [open])

    const loadMethods = async () => {
        setLoadingMethods(true)
        const result = await getMethods()
        if (result.data) {
            // Filter out methods that are already assigned to this assay
            const availableMethods = result.data.filter(
                (m) => !existingMethodIds.includes(m.id)
            )
            setMethods(availableMethods)
        }
        setLoadingMethods(false)
    }

    const resetForm = () => {
        setMethodId('')
        setIsDefault(false)
        setNotes('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!methodId) return

        const formData = new FormData()
        formData.append('assay_id', assayId)
        formData.append('method_id', methodId)
        formData.append('is_default', String(isDefault))
        if (notes) {
            formData.append('notes', notes)
        }

        startTransition(async () => {
            const result = await addMethodToAssay(formData)

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Đã thêm phương pháp vào chỉ tiêu thành công')
                resetForm()
                onOpenChange(false)
            }
        })
    }

    const handleClose = () => {
        if (!isPending) {
            resetForm()
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Thêm phương pháp xét nghiệm</DialogTitle>
                    <DialogDescription>
                        Chọn phương pháp để thêm vào chỉ tiêu này.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Method Select */}
                        <div className="space-y-2">
                            <Label htmlFor="method">Phương pháp <span className="text-red-500">*</span></Label>
                            <Select
                                value={methodId}
                                onValueChange={setMethodId}
                                disabled={isPending || loadingMethods}
                                required
                            >
                                <SelectTrigger id="method">
                                    <SelectValue placeholder="Chọn phương pháp" />
                                </SelectTrigger>
                                <SelectContent>
                                    {methods.length === 0 && !loadingMethods ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            Không còn phương pháp nào khả dụng
                                        </div>
                                    ) : (
                                        methods.map((method) => (
                                            <SelectItem key={method.id} value={method.id}>
                                                {method.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            {loadingMethods && (
                                <p className="text-xs text-muted-foreground">
                                    Đang tải danh sách phương pháp...
                                </p>
                            )}
                        </div>

                        {/* Is Default Checkbox */}
                        <div className="flex items-start space-x-2">
                            <Checkbox
                                id="is_default"
                                checked={isDefault}
                                onCheckedChange={(checked) => setIsDefault(checked === true)}
                                disabled={isPending}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label
                                    htmlFor="is_default"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                    Đặt làm mặc định
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Phương pháp này sẽ được chọn tự động khi chỉ định xét nghiệm.
                                </p>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Ghi chú</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ghi chú thêm về việc áp dụng phương pháp này cho chỉ tiêu..."
                                disabled={isPending}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isPending}
                        >
                            Hủy
                        </Button>
                        <Button type="submit" disabled={isPending || !methodId}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Thêm
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
