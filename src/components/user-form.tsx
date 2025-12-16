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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

// We need a combined schema or handling logic because Create and Update are different
// But for the form, we can just use a loose schema or separate them.

interface UserFormProps {
    user?: User
    currentUserId?: string  // ID of the logged-in user
    onSuccess: () => void
    onCancel: () => void
}

export function UserForm({ user, currentUserId, onSuccess, onCancel }: UserFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [signatureFile, setSignatureFile] = useState<File | null>(null)
    const [signatureError, setSignatureError] = useState<string | null>(null)
    const isEdit = !!user
    const isSelfEdit = isEdit && currentUserId && user.id === currentUserId
    const isOtherEdit = isEdit && !isSelfEdit

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

                // If self-edit and manager role and signature file provided, upload signature
                if (isSelfEdit && user.role === 'manager' && signatureFile) {
                    try {
                        const formData = new FormData()
                        formData.append('file', signatureFile)

                        const signatureResult = await uploadSignatureClient(formData)
                        if (!signatureResult.success) {
                            setSignatureError(signatureResult.error)
                            toast.warning(
                                'Thông tin đã được cập nhật nhưng chữ ký tải lên thất bại. ' +
                                signatureResult.error
                            )
                        } else {
                            toast.success('Đã cập nhật thông tin và chữ ký thành công')
                        }
                    } catch (signatureErr) {
                        console.error('Signature upload error:', signatureErr)
                        setSignatureError('Tải lên chữ ký thất bại')
                        toast.warning('Thông tin đã được cập nhật nhưng chữ ký tải lên thất bại')
                    }
                } else {
                    toast.success('Đã cập nhật người dùng thành công')
                }
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
                {/* Compliance banner when editing other users */}
                {isOtherEdit && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Chế độ quản trị:</strong> Bạn chỉ có thể chỉnh sửa vai trò của người dùng này.
                            Chỉ người dùng mới có thể cập nhật thông tin cá nhân của họ để đảm bảo tuân thủ quy định.
                        </AlertDescription>
                    </Alert>
                )}

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
                                <Input
                                    placeholder="Nguyễn Văn A"
                                    {...field}
                                    disabled={isOtherEdit}
                                />
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
                                <Input
                                    type="email"
                                    placeholder="example@cdc.gov.vn"
                                    {...field}
                                    disabled={isOtherEdit}
                                />
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
                                <Input
                                    placeholder="Phòng xét nghiệm..."
                                    {...field}
                                    disabled={isOtherEdit}
                                />
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
                                <Input
                                    type="password"
                                    {...field}
                                    disabled={isOtherEdit}
                                    placeholder={isOtherEdit ? 'Người dùng tự đặt lại mật khẩu' : ''}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Signature upload section */}
                {/* Case 1: Creating new manager - allow signature upload */}
                {!isEdit && form.watch('role') === 'manager' && (
                    <SignatureUploadField
                        value={signatureFile}
                        onChange={setSignatureFile}
                        error={signatureError || undefined}
                        required={false}
                    />
                )}

                {/* Case 2: Manager editing their own account - allow signature upload/change */}
                {isSelfEdit && user.role === 'manager' && (
                    <SignatureUploadField
                        value={signatureFile}
                        onChange={setSignatureFile}
                        error={signatureError || undefined}
                        required={false}
                    />
                )}

                {/* Case 3: Editing someone else who is a manager - show signature status only */}
                {isOtherEdit && user.role === 'manager' && (
                    <div className="space-y-2">
                        <FormLabel>Chữ ký điện tử</FormLabel>
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                                Người dùng này cần tự tải lên chữ ký điện tử của họ khi đăng nhập.
                                Bạn không thể tải lên chữ ký thay họ để đảm bảo tuân thủ quy định.
                            </AlertDescription>
                        </Alert>
                    </div>
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
