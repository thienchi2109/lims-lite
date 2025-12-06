'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateUserSchema, UpdateUserSchema, User, UserRole } from '@/types'
import { createUser, updateUser } from '@/app/actions/users'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner' // Assuming sonner is used, if not I'll check toast availability
import { z } from 'zod'

// We need a combined schema or handling logic because Create and Update are different
// But for the form, we can just use a loose schema or separate them.

interface UserFormProps {
    user?: User
    onSuccess: () => void
    onCancel: () => void
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isEdit = !!user

    // Form Schema depends on mode
    const formSchema = isEdit 
        ? UpdateUserSchema.extend({
            password: z.string().min(8).optional().or(z.literal('')), // Allow empty for no change
        })
        : CreateUserSchema

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: isEdit ? {
            id: user.id,
            full_name: user.full_name,
            email: user.email || '',
            lab: user.lab || '',
            role: user.role,
            password: '', // Empty for edit
        } : {
            username: '',
            full_name: '',
            email: '',
            lab: '',
            role: 'analyst',
            password: '',
        },
    })

    async function onSubmit(data: any) {
        setIsSubmitting(true)
        try {
            if (isEdit) {
                // Filter out empty password
                const updateData = { ...data }
                if (!updateData.password) delete updateData.password
                
                await updateUser(updateData)
                // Use a generic toast or window alert if sonner not available?
                // I'll assume standard window.alert for now if I can't find toaster
            } else {
                await createUser(data)
            }
            onSuccess()
        } catch (error: any) {
            console.error('Submission error:', error)
            form.setError('root', { 
                message: error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.' 
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {!isEdit && (
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tên đăng nhập</FormLabel>
                                <FormControl>
                                    <Input placeholder="jdoe" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Họ và tên</FormLabel>
                            <FormControl>
                                <Input placeholder="Nguyễn Văn A" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="example@cdc.gov.vn" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="lab"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phòng Lab</FormLabel>
                            <FormControl>
                                <Input placeholder="Phòng xét nghiệm..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Vai trò</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Chọn vai trò" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="analyst">Kỹ thuật viên</SelectItem>
                                    <SelectItem value="manager">Quản lý</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{isEdit ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {form.formState.errors.root && (
                    <div className="text-red-500 text-sm">
                        {form.formState.errors.root.message}
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Hủy
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo mới')}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
