'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateUserSchema, UpdateUserSchema, type CreateUser, type UpdateUser, type User } from '@/types'
import { createUserClient, updateUserClient, uploadSignatureClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
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
import { SignatureUploadField } from '@/components/signature-upload-field'
import { toast } from 'sonner'
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
    const [signatureFile, setSignatureFile] = useState<File | null>(null)
    const [signatureError, setSignatureError] = useState<string | null>(null)
    const isEdit = !!user

    const updateSchema = UpdateUserSchema.extend({
        password: z.string().min(8).optional().or(z.literal('')),
    })

    type CreateUserFormValues = z.infer<typeof CreateUserSchema>
    type UpdateUserFormValues = z.infer<typeof updateSchema>
    type UserFormValues = CreateUserFormValues | UpdateUserFormValues

    const form = useForm<UserFormValues>({
        resolver: zodResolver(isEdit ? updateSchema : CreateUserSchema),
        defaultValues: (isEdit
            ? {
                  id: user?.id ?? '',
                  full_name: user?.full_name ?? '',
                  email: user?.email || '',
                  lab: user?.lab || '',
                  role: user?.role ?? 'analyst',
                  password: '',
              }
            : {
                  username: '',
                  full_name: '',
                  email: '',
                  lab: '',
                  role: 'analyst',
                  password: '',
              }) as UserFormValues,
    })

    const hasActionError = (result: any): result is { error: string } =>
        Boolean(result && typeof result === 'object' && 'error' in result)

    async function onSubmit(values: UserFormValues) {
        setIsSubmitting(true)
        setSignatureError(null)

        try {
            if (isEdit && user) {
                const updateValues = values as UpdateUserFormValues
                const updatePayload: UpdateUser = {
                    id: user.id,
                    full_name: updateValues.full_name || undefined,
                    role: updateValues.role ?? user.role,
                    email: updateValues.email || undefined,
                    lab: updateValues.lab || undefined,
                }

                if (updateValues.password) {
                    updatePayload.password = updateValues.password
                }

                const result = await updateUserClient(updatePayload)
                if (hasActionError(result)) {
                    throw new Error(result.error)
                }
                toast.success('Đã cập nhật người dùng thành công')
            } else {
                const createValues = values as CreateUserFormValues
                const createPayload: CreateUser = {
                    username: createValues.username,
                    full_name: createValues.full_name,
                    password: createValues.password,
                    role: createValues.role,
                    email: createValues.email || undefined,
                    lab: createValues.lab || undefined,
                }

                const result = await createUserClient(createPayload)
                if (hasActionError(result)) {
                    throw new Error(result.error)
                }

                // If manager role and signature file provided, upload signature
                if (createValues.role === 'manager' && signatureFile) {
                    try {
                        const formData = new FormData()
                        formData.append('file', signatureFile)

                        const signatureResult = await uploadSignatureClient(formData)
                        if (!signatureResult.success) {
                            // Signature upload failed, but user was created
                            setSignatureError(signatureResult.error)
                            toast.warning(
                                'Tài khoản đã được tạo nhưng chữ ký tải lên thất bại. ' +
                                'Vui lòng tải lên chữ ký trong Cài đặt.'
                            )
                        } else {
                            toast.success('Đã tạo người dùng mới và tải lên chữ ký thành công')
                        }
                    } catch (signatureErr) {
                        console.error('Signature upload error:', signatureErr)
                        setSignatureError('Tải lên chữ ký thất bại')
                        toast.warning(
                            'Tài khoản đã được tạo nhưng chữ ký tải lên thất bại. ' +
                            'Vui lòng tải lên chữ ký trong Cài đặt.'
                        )
                    }
                } else {
                    toast.success('Đã tạo người dùng mới')
                }
            }
            onSuccess()
        } catch (error) {
            console.error('Submission error:', error)
            const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.'
            form.setError('root', { message })
            toast.error(message)
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

                {/* Signature upload for manager role (only during creation) */}
                {!isEdit && form.watch('role') === 'manager' && (
                    <SignatureUploadField
                        value={signatureFile}
                        onChange={setSignatureFile}
                        error={signatureError || undefined}
                        required={false}
                    />
                )}

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
