'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import {
    createAssayDefinitionClient,
    updateAssayDefinitionClient,
    fetchMethodsClient,
} from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { AssayMethodsList } from './assay-methods-list'
import { LabSpecialty } from '@/types'

type Method = {
    id: string
    name: string
    description: string | null
}

type AssayMethod = {
    id: string
    method_id: string
    name: string
    is_default: boolean
    notes: string | null
}

type AssayDefinition = {
    id: string
    name: string
    specialty_id?: string | null
    units: string | null
    validation_rules: Record<string, any>
    methods?: AssayMethod[]
}

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: 'create' | 'edit'
    assay?: AssayDefinition
    specialties?: LabSpecialty[]
    onCreated?: (assay: AssayDefinition) => void
    onUpdated?: (assay: AssayDefinition) => void
}

export function AssayDefinitionDialog({
    open,
    onOpenChange,
    mode,
    assay,
    specialties = [],
    onCreated,
    onUpdated,
}: Props) {
    const [isPending, startTransition] = useTransition()
    const [methods, setMethods] = useState<Method[]>([])
    const [loadingMethods, setLoadingMethods] = useState(true)

    const router = useRouter()

    // Form state
    const [name, setName] = useState('')
    const [specialtyId, setSpecialtyId] = useState<string>('')
    const [methodId, setMethodId] = useState<string>('')
    const [units, setUnits] = useState('')

    // Validation rules - individual fields
    const [minValue, setMinValue] = useState('')
    const [maxValue, setMaxValue] = useState('')
    const [dataType, setDataType] = useState<string>('numeric')
    const [isRequired, setIsRequired] = useState(false)

    // Load methods on mount
    useEffect(() => {
        if (open && mode === 'create') {
            loadMethods()
        }
    }, [open, mode])

    // Initialize form when editing
    useEffect(() => {
        if (mode === 'edit' && assay) {
            setName(assay.name)
            setSpecialtyId(assay.specialty_id || '')
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
        const result = await fetchMethodsClient()
        if (result.data) {
            const methodsData = result.data as Method[]
            // Deduplicate by name to ensure unique values in dropdown
            const uniqueMethods = methodsData.filter((method, index, self) =>
                index === self.findIndex((candidate) => candidate.name === method.name)
            )
            setMethods(uniqueMethods)
        }
        setLoadingMethods(false)
    }

    const resetForm = () => {
        setName('')
        setSpecialtyId('')
        setMethodId('')
        setUnits('')
        setMinValue('')
        setMaxValue('')
        setDataType('numeric')
        setIsRequired(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (mode === 'edit' && !assay) {
            toast.error('Không tìm thấy chỉ tiêu để cập nhật')
            return
        }

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

        const basePayload = {
            name,
            specialty_id: specialtyId || undefined,
            units: units || undefined,
            validationRules: Object.keys(validationRules).length > 0 ? validationRules : undefined,
        }

        startTransition(async () => {
            try {
                const result = mode === 'create'
                    ? await createAssayDefinitionClient({
                        ...basePayload,
                        methodId: methodId || undefined,
                    })
                    : await updateAssayDefinitionClient({
                        ...basePayload,
                        id: assay!.id,
                    })

                const returnedAssay = (result as any)?.data as AssayDefinition | undefined
                if (returnedAssay) {
                    if (mode === 'create') {
                        onCreated?.(returnedAssay)
                    } else {
                        onUpdated?.(returnedAssay)
                    }
                }

                toast.success(
                    mode === 'create'
                        ? 'Đã tạo chỉ tiêu xét nghiệm thành công'
                        : 'Đã cập nhật chỉ tiêu xét nghiệm thành công'
                )
                resetForm()
                onOpenChange(false)
                router.refresh()
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không mong muốn'
                toast.error(message)
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
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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

                <div className="space-y-6">
                    <form id="assay-form" onSubmit={handleSubmit}>
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

                            {/* Specialty - Required */}
                            <div className="space-y-2">
                                <Label htmlFor="specialty">Nhóm xét nghiệm <span className="text-red-500">*</span></Label>
                                <Select
                                    value={specialtyId}
                                    onValueChange={setSpecialtyId}
                                    disabled={isPending}
                                    required
                                >
                                    <SelectTrigger id="specialty">
                                        <SelectValue placeholder="Chọn nhóm xét nghiệm" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {specialties?.map((specialty) => (
                                            <SelectItem key={specialty.id} value={specialty.id}>
                                                {specialty.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Method - Only show in create mode */}
                            {mode === 'create' && (
                                <div className="space-y-2">
                                    <Label htmlFor="method">Phương pháp ban đầu <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={methodId}
                                        onValueChange={setMethodId}
                                        disabled={isPending || loadingMethods}
                                        required
                                    >
                                        <SelectTrigger id="method">
                                            <SelectValue placeholder="Chọn phương pháp" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
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
                                    <p className="text-xs text-muted-foreground">
                                        Bạn có thể thêm nhiều phương pháp khác sau khi tạo.
                                    </p>
                                </div>
                            )}

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
                                                disabled={isPending || dataType === 'boolean'}
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
                                                disabled={isPending || dataType === 'boolean'}
                                            />
                                        </div>
                                    </div>

                                    {/* Data Type */}
                                    <div className="space-y-2 mb-4">
                                        <Label htmlFor="data_type">Kiểu dữ liệu</Label>
                                        <Select
                                            value={dataType}
                                            onValueChange={(val) => {
                                                setDataType(val)
                                                if (val === 'boolean') {
                                                    setMinValue('')
                                                    setMaxValue('')
                                                }
                                            }}
                                            disabled={isPending}
                                        >
                                            <SelectTrigger id="data_type">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="numeric">Số (Numeric)</SelectItem>
                                                <SelectItem value="text">Văn bản (Text)</SelectItem>
                                                <SelectItem value="boolean">Dương tính/Âm tính</SelectItem>
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
                    </form>

                    {/* Methods Management (Edit Mode Only) */}
                    {mode === 'edit' && assay && (
                        <div className="border-t pt-6">
                            <AssayMethodsList
                                assayId={assay.id}
                                methods={assay.methods || []}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-6">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isPending}
                    >
                        Hủy
                    </Button>
                    <Button type="submit" form="assay-form" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {mode === 'create' ? 'Tạo' : 'Cập nhật'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
