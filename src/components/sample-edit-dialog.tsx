'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateSample } from '@/app/actions/samples'
import { SampleWithUser } from '@/types'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const formSchema = z.object({
    client_name: z.string().min(1, 'Tên khách hàng không được để trống').max(200, 'Tên khách hàng quá dài'),
})

interface SampleEditDialogProps {
    sample: SampleWithUser
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function SampleEditDialog({
    sample,
    open,
    onOpenChange,
    onSuccess,
}: SampleEditDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            client_name: sample.client_name || '',
        },
    })

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true)
        try {
            const result = await updateSample({
                id: sample.id,
                client_name: values.client_name,
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Cập nhật mẫu thành công')
            onOpenChange(false)
            if (onSuccess) {
                onSuccess()
            }
        } catch (error) {
            toast.error('Đã xảy ra lỗi khi cập nhật mẫu')
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Chỉnh sửa mẫu</DialogTitle>
                    <DialogDescription>
                        Cập nhật thông tin cho mẫu {sample.sample_id}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="client_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tên khách hàng</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nhập tên khách hàng" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Lưu thay đổi
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
