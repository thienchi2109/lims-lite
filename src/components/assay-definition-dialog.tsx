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
import { Checkbox } from '@/components/ui/checkbox'
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

    // Validation rules - individual fields
    const [minValue, setMinValue] = useState('')
    const [maxValue, setMaxValue] = useState('')
    const [dataType, setDataType] = useState<string>('numeric')
    const [isRequired, setIsRequired] = useState(false)

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

            // Parse validation rules into individual fields
            const rules = assay.validation_rules || {}
            setMinValue(rules.min !== undefined ? String(rules.min) : '')
            setMaxValue(rules.max !== undefined ? String(rules.max) : '')
            setDataType(rules.type || rules.dataType || 'numeric')
            setIsRequired(rules.required === true)
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
        setMinValue('')
        setMaxValue('')
        setDataType('numeric')
        setIsRequired(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Build validation rules from individual fields
        const validationRules: Record<string, any> = {}

        if (minValue !== '') {
            const minNum = parseFloat(minValue)
            if (!isNaN(minNum)) {
                validationRules.min = minNum
            }
        }

        if (maxValue !== '') {
            const maxNum = parseFloat(maxValue)
            if (!isNaN(maxNum)) {
                validationRules.max = maxNum
            }
        }

        if (dataType) {
            validationRules.type = dataType
        }

        if (isRequired) {
            validationRules.required = true
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

                        {/* Validation Rules Section */}
                        <div className="space-y-4 pt-2">
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-3">Quy tắc xác thực (không bắt buộc)</h4>

                                {/* Min and Max in a grid */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="min_value">Giá trị tối thiểu</Label>
                                        <Input
                                            id="min_value"
                                            type="number"
                                            step="any"
                                            value={minValue}
                                            onChange={(e) => setMinValue(e.target.value)}
                                            placeholder="0"
                                            disabled={isPending}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="max_value">Giá trị tối đa</Label>
                                        <Input
                                            id="max_value"
                                            type="number"
                                            step="any"
                                            value={maxValue}
                                            onChange={(e) => setMaxValue(e.target.value)}
                                            placeholder="100"
                                            disabled={isPending}
                                        />
                                    </div>
                                </div>

                                {/* Data Type */}
                                <div className="space-y-2 mb-4">
                                    <Label htmlFor="data_type">Kiểu dữ liệu</Label>
                                    <Select
                                        value={dataType}
                                        onValueChange={setDataType}
                                        disabled={isPending}
                                    >
                                        <SelectTrigger id="data_type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="numeric">Số (Numeric)</SelectItem>
                                            <SelectItem value="text">Văn bản (Text)</SelectItem>
                                            <SelectItem value="boolean">Đúng/Sai (Boolean)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Required Checkbox */}
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="is_required"
                                        checked={isRequired}
                                        onCheckedChange={(checked) => setIsRequired(checked === true)}
                                        disabled={isPending}
                                    />
                                    <Label
                                        htmlFor="is_required"
                                        className="text-sm font-normal cursor-pointer"
                                    >
                                        Bắt buộc nhập kết quả
                                    </Label>
                                </div>
                            </div>
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
