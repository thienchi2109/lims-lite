'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CoAManualInputsSchema, type CoAManualInputs } from '@/types'
import { regenerateCoAClient } from '@/lib/api-client'
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
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'

interface CoAGenerationDialogProps {
    sampleId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CoAGenerationDialog({
    sampleId,
    open,
    onOpenChange,
}: CoAGenerationDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        reset,
    } = useForm<CoAManualInputs>({
        resolver: zodResolver(CoAManualInputsSchema),
        defaultValues: {
            referrer: '',
            sampleQuality: 'Tốt',
        },
    })

    const sampleQuality = watch('sampleQuality')

    const onSubmit = async (data: CoAManualInputs) => {
        setIsSubmitting(true)

        try {
            const result = await regenerateCoAClient(sampleId, data)

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Tạo CoA thành công')
                onOpenChange(false)
                reset()
                router.refresh()
            }
        } catch (error) {
            toast.error('Đã xảy ra lỗi không mong đợi')
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Tạo giấy chứng nhận phân tích (CoA)
                    </DialogTitle>
                    <DialogDescription>
                        Nhập thông tin bổ sung cho giấy chứng nhận
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Referrer/Physician Field */}
                    <div className="space-y-2">
                        <Label htmlFor="referrer">
                            Bác sĩ chỉ định <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="referrer"
                            placeholder="Nhập tên bác sĩ chỉ định"
                            {...register('referrer')}
                            disabled={isSubmitting}
                        />
                        {errors.referrer && (
                            <p className="text-sm text-red-500">{errors.referrer.message}</p>
                        )}
                    </div>

                    {/* Sample Quality Field */}
                    <div className="space-y-2">
                        <Label htmlFor="sampleQuality">
                            Chất lượng mẫu <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={sampleQuality}
                            onValueChange={(value) => setValue('sampleQuality', value as any)}
                            disabled={isSubmitting}
                        >
                            <SelectTrigger id="sampleQuality">
                                <SelectValue placeholder="Chọn chất lượng mẫu" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Tốt">Tốt</SelectItem>
                                <SelectItem value="Đạt">Đạt</SelectItem>
                                <SelectItem value="Không đạt">Không đạt</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.sampleQuality && (
                            <p className="text-sm text-red-500">{errors.sampleQuality.message}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Hủy
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang tạo...
                                </>
                            ) : (
                                'Tạo CoA'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
