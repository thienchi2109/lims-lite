'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateClientSchema, type CreateClient, type Client, Gender } from '@/types'
import { updateClientClient, upsertClientClient } from '@/lib/api-client'
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
import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientFormProps {
    mode?: 'upsert' | 'update'
    clientId?: string
    initialData?: Partial<CreateClient>
    onSuccess: (client: Client) => void
    onCancel: () => void
    className?: string
}

export function ClientForm({
    mode = 'upsert',
    clientId,
    initialData,
    onSuccess,
    onCancel,
    className
}: ClientFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    // Prepare safe gender value from initialData
    const safeGender: Gender = (() => {
        if (!initialData?.gender) return 'Khác'
        const parseResult = Gender.safeParse(initialData.gender)
        return parseResult.success ? parseResult.data : 'Khác'
    })()

    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
    } = useForm<CreateClient>({
        resolver: zodResolver(CreateClientSchema),
        // Use defaultValues with initialData - key prop forces remount
        defaultValues: initialData ? {
            name: initialData.name || '',
            id_card_num: initialData.id_card_num || '',
            date_of_birth: initialData.date_of_birth || '',
            gender: safeGender,
            phone: initialData.phone || '',
            address: initialData.address || '',
            health_insurance_num: initialData.health_insurance_num || '',
            expiry_date: initialData.expiry_date || '',
        } : {
            name: '',
            id_card_num: '',
            date_of_birth: '',
            gender: 'Khác',
            phone: '',
            address: '',
            health_insurance_num: '',
            expiry_date: '',
        },
    })

    const onSubmit = async (data: CreateClient) => {
        setIsSubmitting(true)
        setSubmitError(null)

        try {
            if (mode === 'update' && !clientId) {
                setSubmitError('Client ID không hợp lệ')
                return
            }

            const result =
                mode === 'update'
                    ? await updateClientClient(clientId as string, data)
                    : await upsertClientClient(data)

            if (result.error) {
                setSubmitError(result.error)
            } else if (result.data) {
                onSuccess(result.data)
            }
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi lưu khách hàng')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            handleSubmit(onSubmit)()
        }
    }

    return (
        <div
            className={cn("space-y-4", className)}
            onKeyDown={handleKeyDown}
        >
            {/* Error Message */}
            {submitError && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm flex items-center gap-2" role="alert">
                    <AlertCircle className="h-4 w-4" />
                    {submitError}
                </div>
            )}

            <div className="space-y-3">
                {/* Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Họ và tên *
                    </Label>
                    <Input
                        id="name"
                        {...register('name')}
                        placeholder="Nhập họ tên đầy đủ"
                        className="shadow-sm h-9"
                    />
                    {errors.name && (
                        <p className="text-xs text-red-600" role="alert">{errors.name.message}</p>
                    )}
                </div>

                {/* ID Card */}
                <div className="space-y-1.5">
                    <Label htmlFor="id_card_num" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Số CMND/CCCD *
                    </Label>
                    <Input
                        id="id_card_num"
                        {...register('id_card_num')}
                        placeholder="Nhập số giấy tờ tùy thân"
                        className="shadow-sm h-9"
                    />
                    {errors.id_card_num && (
                        <p className="text-xs text-red-600" role="alert">{errors.id_card_num.message}</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                {/* Gender */}
                    <div className="space-y-1.5">
                        <Label htmlFor="gender" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Giới tính *
                        </Label>
                        <Controller
                            name="gender"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    value={field.value}
                                    onValueChange={(value) => field.onChange(value as Gender)}
                                >
                                    <SelectTrigger className="shadow-sm h-9">
                                        <SelectValue placeholder="Chọn" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Nam">Nam</SelectItem>
                                        <SelectItem value="Nữ">Nữ</SelectItem>
                                        <SelectItem value="Khác">Khác</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.gender && (
                            <p className="text-xs text-red-600" role="alert">{errors.gender.message}</p>
                        )}
                    </div>

                    {/* DOB */}
                    <div className="space-y-1.5">
                        <Label htmlFor="date_of_birth" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Ngày sinh *
                        </Label>
                        <Input
                            id="date_of_birth"
                            type="date"
                            {...register('date_of_birth')}
                            className="shadow-sm h-9"
                        />
                        {errors.date_of_birth && (
                            <p className="text-xs text-red-600" role="alert">{errors.date_of_birth.message}</p>
                        )}
                    </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Số điện thoại *
                    </Label>
                    <Input
                        id="phone"
                        {...register('phone')}
                        placeholder="09xxxxxxxx"
                        className="shadow-sm h-9"
                    />
                    {errors.phone && (
                        <p className="text-xs text-red-600" role="alert">{errors.phone.message}</p>
                    )}
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                    <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Địa chỉ
                    </Label>
                    <Input
                        id="address"
                        {...register('address')}
                        placeholder="Nhập địa chỉ liên hệ"
                        className="shadow-sm h-9"
                    />
                </div>

                {/* Health Insurance */}
                <div className="space-y-1.5">
                    <Label htmlFor="health_insurance_num" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Số BHYT
                    </Label>
                    <Input
                        id="health_insurance_num"
                        {...register('health_insurance_num')}
                        placeholder="Nhập số BHYT (nếu có)"
                        className="shadow-sm h-9"
                    />
                </div>

                {/* Expiry Date */}
                <div className="space-y-1.5">
                    <Label htmlFor="expiry_date" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Hạn sử dụng BHYT
                    </Label>
                    <Input
                        id="expiry_date"
                        type="date"
                        {...register('expiry_date')}
                        className="shadow-sm h-9"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="h-9"
                >
                    Hủy bỏ
                </Button>
                <Button
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                    className="bg-sky-600 hover:bg-sky-700 text-white h-9"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang lưu...
                        </>
                    ) : (
                        'Lưu khách hàng'
                    )}
                </Button>
            </div>
        </div>
    )
}
