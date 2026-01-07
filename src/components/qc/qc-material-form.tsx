'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { createQCMaterial, updateQCMaterial } from '@/app/actions/qc-setup'
import { QCLevel } from '@/types/qc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

import type { QCMaterial } from './qc-materials-table'

// ============================================================================
// FORM SCHEMA WITH VIETNAMESE VALIDATION MESSAGES
// ============================================================================

const QCMaterialFormSchema = z.object({
    name: z
        .string()
        .min(1, 'Tên vật liệu là bắt buộc')
        .max(200, 'Tên vật liệu tối đa 200 ký tự'),
    manufacturer: z
        .string()
        .min(1, 'Nhà sản xuất là bắt buộc')
        .max(200, 'Nhà sản xuất tối đa 200 ký tự'),
    lot_number: z
        .string()
        .min(1, 'Số lô là bắt buộc')
        .max(100, 'Số lô tối đa 100 ký tự'),
    expiry_date: z
        .string()
        .min(1, 'Ngày hết hạn là bắt buộc')
        .refine((val) => !isNaN(Date.parse(val)), {
            message: 'Ngày hết hạn không hợp lệ',
        }),
    level: QCLevel,
})

type QCMaterialFormData = z.infer<typeof QCMaterialFormSchema>

// ============================================================================
// PROPS INTERFACE
// ============================================================================

interface QCMaterialFormProps {
    /** Existing material for edit mode (undefined for create mode) */
    material?: QCMaterial
    /** Callback when form submission succeeds */
    onSuccess: () => void
    /** Callback when cancel button is clicked */
    onCancel: () => void
}

// ============================================================================
// LEVEL OPTIONS WITH VIETNAMESE LABELS
// ============================================================================

const LEVEL_OPTIONS = [
    { value: 'low', label: 'Thấp (Low)' },
    { value: 'normal', label: 'Bình thường (Normal)' },
    { value: 'high', label: 'Cao (High)' },
] as const

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Form component for creating and editing QC materials
 *
 * Features:
 * - Zod validation with Vietnamese error messages
 * - useTransition for pending state during submission
 * - Edit mode: lot_number field is disabled
 * - Vietnamese UI labels
 */
export function QCMaterialForm({
    material,
    onSuccess,
    onCancel,
}: QCMaterialFormProps) {
    const [isPending, startTransition] = useTransition()
    const isEditMode = !!material

    const form = useForm<QCMaterialFormData>({
        resolver: zodResolver(QCMaterialFormSchema),
        defaultValues: {
            name: material?.name ?? '',
            manufacturer: material?.manufacturer ?? '',
            lot_number: material?.lot_number ?? '',
            expiry_date: material?.expiry_date?.split('T')[0] ?? '',
            level: (material?.level as QCMaterialFormData['level']) ?? 'normal',
        },
    })

    const handleSubmit = (data: QCMaterialFormData) => {
        startTransition(async () => {
            try {
                if (isEditMode && material) {
                    // Update existing material
                    const result = await updateQCMaterial({
                        id: material.id,
                        name: data.name,
                        manufacturer: data.manufacturer,
                        expiry_date: data.expiry_date,
                        level: data.level,
                        // Note: lot_number is not updated in edit mode
                    })

                    if ('error' in result) {
                        toast.error(result.error)
                        return
                    }

                    toast.success('Cập nhật vật liệu QC thành công')
                } else {
                    // Create new material
                    const result = await createQCMaterial({
                        name: data.name,
                        manufacturer: data.manufacturer,
                        lot_number: data.lot_number,
                        expiry_date: data.expiry_date,
                        level: data.level,
                    })

                    if ('error' in result) {
                        toast.error(result.error)
                        return
                    }

                    toast.success('Thêm vật liệu QC thành công')
                }

                onSuccess()
            } catch (error) {
                console.error('QCMaterialForm submission error:', error)
                toast.error('Đã xảy ra lỗi. Vui lòng thử lại.')
            }
        })
    }

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-2">
                <Label htmlFor="name">Tên vật liệu</Label>
                <Input
                    id="name"
                    placeholder="Nhập tên vật liệu QC..."
                    {...form.register('name')}
                    disabled={isPending}
                />
                {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                        {form.formState.errors.name.message}
                    </p>
                )}
            </div>

            {/* Manufacturer Field */}
            <div className="space-y-2">
                <Label htmlFor="manufacturer">Nhà sản xuất</Label>
                <Input
                    id="manufacturer"
                    placeholder="Nhập nhà sản xuất..."
                    {...form.register('manufacturer')}
                    disabled={isPending}
                />
                {form.formState.errors.manufacturer && (
                    <p className="text-sm text-destructive">
                        {form.formState.errors.manufacturer.message}
                    </p>
                )}
            </div>

            {/* Lot Number Field */}
            <div className="space-y-2">
                <Label htmlFor="lot_number">Số lô</Label>
                <Input
                    id="lot_number"
                    placeholder="Nhập số lô..."
                    {...form.register('lot_number')}
                    disabled={isPending || isEditMode}
                />
                {isEditMode && (
                    <p className="text-sm text-muted-foreground">
                        Số lô không thể thay đổi sau khi tạo
                    </p>
                )}
                {form.formState.errors.lot_number && (
                    <p className="text-sm text-destructive">
                        {form.formState.errors.lot_number.message}
                    </p>
                )}
            </div>

            {/* Level Field */}
            <div className="space-y-2">
                <Label htmlFor="level">Mức độ</Label>
                <Select
                    value={form.watch('level')}
                    onValueChange={(value) =>
                        form.setValue('level', value as QCMaterialFormData['level'])
                    }
                    disabled={isPending}
                >
                    <SelectTrigger id="level">
                        <SelectValue placeholder="Chọn mức độ..." />
                    </SelectTrigger>
                    <SelectContent>
                        {LEVEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {form.formState.errors.level && (
                    <p className="text-sm text-destructive">
                        {form.formState.errors.level.message}
                    </p>
                )}
            </div>

            {/* Expiry Date Field */}
            <div className="space-y-2">
                <Label htmlFor="expiry_date">Ngày hết hạn</Label>
                <Input
                    id="expiry_date"
                    type="date"
                    {...form.register('expiry_date')}
                    disabled={isPending}
                />
                {form.formState.errors.expiry_date && (
                    <p className="text-sm text-destructive">
                        {form.formState.errors.expiry_date.message}
                    </p>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isPending}
                >
                    Hủy
                </Button>
                <Button type="submit" disabled={isPending}>
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang xử lý...
                        </>
                    ) : isEditMode ? (
                        'Cập nhật'
                    ) : (
                        'Thêm mới'
                    )}
                </Button>
            </div>
        </form>
    )
}
