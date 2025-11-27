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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createAssayDefinition, updateAssayDefinition, getMethods } from '@/app/actions/assays'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type Method = {
    id: string
    name: string
    description: string | null
}

type AssayDefinition = {
    id: string
    name: string
    method_id: string | null
    method_name: string | null
    units: string | null
    validation_rules: Record<string, any>
}

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: 'create' | 'edit'
    assay?: AssayDefinition
}

export function AssayDefinitionDialog({ open, onOpenChange, mode, assay }: Props) {
    const [isPending, startTransition] = useTransition()
    const [methods, setMethods] = useState<Method[]>([])
    const [loadingMethods, setLoadingMethods] = useState(true)

    // Form state
    const [name, setName] = useState('')
    const [methodId, setMethodId] = useState<string>('')
    const [units, setUnits] = useState('')
    const [validationRulesJson, setValidationRulesJson] = useState('')

    // Load methods on mount
    useEffect(() => {
        if (open) {
            loadMethods()
        }
    }, [open])

    // Initialize form when editing
    useEffect(() => {
        if (mode === 'edit' && assay) {
            setName(assay.name)
            setMethodId(assay.method_id || '')
            setUnits(assay.units || '')
            setValidationRulesJson(
                assay.validation_rules && Object.keys(assay.validation_rules).length > 0
                    ? JSON.stringify(assay.validation_rules, null, 2)
                    : ''
            )
        } else if (mode === 'create') {
            resetForm()
        }
    }, [mode, assay, open])

    const loadMethods = async () => {
        setLoadingMethods(true)
        const result = await getMethods()
        if (result.data) {
            setMethods(result.data)
        }
        setLoadingMethods(false)
    }

    const resetForm = () => {
        setName('')
        setMethodId('')
        setUnits('')
        setValidationRulesJson('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validate JSON if provided
        let validationRules = {}
        if (validationRulesJson.trim()) {
            try {
                validationRules = JSON.parse(validationRulesJson)
            } catch (error) {
                toast.error('Quy tắc xác thực phải là JSON hợp lệ')
                return
            }
        }

        const formData = new FormData()
        if (mode === 'edit' && assay) {
            formData.append('id', assay.id)
        }
        formData.append('name', name)
        if (methodId) {
            formData.append('method_id', methodId)
        }
        if (units) {
            formData.append('units', units)
        }
        if (Object.keys(validationRules).length > 0) {
            formData.append('validation_rules', JSON.stringify(validationRules))
        }

        startTransition(async () => {
            const result = mode === 'create'
                ? await createAssayDefinition(formData)
                : await updateAssayDefinition(formData)

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(
                    mode === 'create'
                        ? 'Đã tạo chỉ tiêu xét nghiệm thành công'
                        : 'Đã cập nhật chỉ tiêu xét nghiệm thành công'
                )
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
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Thêm chỉ tiêu xét nghiệm' : 'Sửa chỉ tiêu xét nghiệm'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Nhập thông tin chỉ tiêu xét nghiệm mới'
                            : 'Cập nhật thông tin chỉ tiêu xét nghiệm'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                Tên chỉ tiêu <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ví dụ: pH, Độ đục, E.coli"
                                required
                                disabled={isPending}
                            />
                        </div>

                        {/* Method */}
                        <div className="space-y-2">
                            <Label htmlFor="method">Phương pháp</Label>
                            <Select
                                value={methodId}
                                onValueChange={setMethodId}
                                disabled={isPending || loadingMethods}
                            >
                                <SelectTrigger id="method">
                                    <SelectValue placeholder="Chọn phương pháp (không bắt buộc)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Không chọn phương pháp</SelectItem>
                                    {methods.map((method) => (
                                        <SelectItem key={method.id} value={method.id}>
                                            {method.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {loadingMethods && (
                                <p className="text-xs text-muted-foreground">
                                    Đang tải danh sách phương pháp...
                                </p>
                            )}
                        </div>

                        {/* Units */}
                        <div className="space-y-2">
                            <Label htmlFor="units">Đơn vị</Label>
                            <Input
                                id="units"
                                value={units}
                                onChange={(e) => setUnits(e.target.value)}
                                placeholder="Ví dụ: mg/L, CFU/100mL, NTU"
                                disabled={isPending}
                            />
                        </div>

                        {/* Validation Rules */}
                        <div className="space-y-2">
                            <Label htmlFor="validation_rules">
                                Quy tắc xác thực (JSON)
                            </Label>
                            <Textarea
                                id="validation_rules"
                                value={validationRulesJson}
                                onChange={(e) => setValidationRulesJson(e.target.value)}
                                placeholder='{"min": 0, "max": 14, "type": "number"}'
                                rows={4}
                                disabled={isPending}
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Nhập JSON để định nghĩa quy tắc xác thực (không bắt buộc)
                            </p>
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
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {mode === 'create' ? 'Tạo' : 'Cập nhật'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
