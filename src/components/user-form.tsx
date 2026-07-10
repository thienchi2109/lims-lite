'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateUserSchema, UpdateUserSchema, type CreateUser, type UpdateUser, type User } from '@/types'
import { createUserClient, updateUserClient, uploadSignatureClient } from '@/lib/api-client'
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
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { UserFormRoleAccessFields } from '@/components/user-form-role-access-fields'
import { UserFormSignatureSection } from '@/components/user-form-signature-section'
import { getUserRoleLabel } from '@/lib/role-labels'

interface UserFormProps {
    user?: User
    currentUserId?: string  // ID of the logged-in user
    currentUserRole?: User['role']
    onSuccess: () => void
    onCancel: () => void
}

export function UserForm({ user, currentUserId, currentUserRole, onSuccess, onCancel }: UserFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [signatureFile, setSignatureFile] = useState<File | null>(null)
    const [signatureError, setSignatureError] = useState<string | null>(null)
    const isEdit = !!user
    const isSelfEdit = Boolean(isEdit && currentUserId && user.id === currentUserId)
    const isOtherEdit = Boolean(isEdit && !isSelfEdit)

    const createSchema = CreateUserSchema.safeExtend({
        otpEmail: z.string().email('Email OTP không hợp lệ').optional().or(z.literal('')),
    })

    const updateSchema = UpdateUserSchema.extend({
        id: z.string().uuid().optional(),
        full_name: z.string().min(1).max(100).optional().or(z.literal('')),
        email: z.string().email().optional().or(z.literal('')),
        lab: z.string().optional().or(z.literal('')),
        password: z.string().min(8).optional().or(z.literal('')),
        can_access_confidential: z.boolean().optional(),
        otpEmail: z.string().email('Email OTP không hợp lệ').optional().or(z.literal('')),
    })

    type CreateUserFormValues = z.infer<typeof createSchema>
    type UpdateUserFormValues = z.infer<typeof updateSchema>
    type UserFormValues = CreateUserFormValues | UpdateUserFormValues

    const form = useForm<UserFormValues>({
        resolver: zodResolver(isEdit ? updateSchema : createSchema),
        defaultValues: (isEdit
            ? {
                  full_name: user?.full_name ?? '',
                  email: user?.email || '',
                  lab: user?.lab || '',
                  password: '',
                  can_access_confidential: user?.can_access_confidential ?? false,
                  otpEmail: '',
              }
            : {
                  username: '',
                  full_name: '',
                  email: '',
                  lab: '',
                  role: 'analyst',
                  password: '',
                  can_access_confidential: false,
                  otpEmail: '',
              }) as UserFormValues,
    })
    const selectedRole = useWatch({
        control: form.control,
        name: 'role',
    })
    const effectiveRole = isEdit ? user?.role : selectedRole
    const isAnalystForm = effectiveRole === 'analyst'
    const canEditConfidentialAccess = currentUserRole !== 'manager' || isAnalystForm
    const canConfigureAnalystOtpEmail = isAnalystForm && !isSelfEdit

    const hasActionError = (result: unknown): result is { error: string } =>
        Boolean(result && typeof result === 'object' && 'error' in result)

    async function onSubmit(values: UserFormValues) {
        setIsSubmitting(true)
        setSignatureError(null)
        const userForUpdate = isEdit ? user : undefined
        const reportSubmissionError = (error: unknown) => {
            console.error('Submission error:', error)
            const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.'
            form.setError('root', { message })
            toast.error(message)
        }

        if (userForUpdate) {
            const updateValues = values as UpdateUserFormValues
            const updatePayload: UpdateUser = {
                id: userForUpdate.id,
                full_name: updateValues.full_name || undefined,
                email: updateValues.email || undefined,
                lab: updateValues.lab || undefined,
            }

            if (canEditConfidentialAccess) {
                updatePayload.can_access_confidential = updateValues.can_access_confidential ?? userForUpdate.can_access_confidential
            }

            if (canConfigureAnalystOtpEmail && updateValues.otpEmail) {
                updatePayload.otpEmail = updateValues.otpEmail
            }

            if (updateValues.password) {
                updatePayload.password = updateValues.password
            }

            const result = await updateUserClient(updatePayload).catch((error) => {
                reportSubmissionError(error)
                return null
            })
            if (!result) {
                setIsSubmitting(false)
                return
            }
            if (hasActionError(result)) {
                form.setError('root', { message: result.error })
                toast.error(result.error)
                setIsSubmitting(false)
                return
            }

            if (isSelfEdit && userForUpdate.role === 'manager' && signatureFile) {
                const formData = new FormData()
                formData.append('file', signatureFile)

                const signatureResult = await uploadSignatureClient(formData).catch((signatureErr) => {
                    console.error('Signature upload error:', signatureErr)
                    setSignatureError('Tải lên chữ ký thất bại')
                    toast.warning('Thông tin đã được cập nhật nhưng chữ ký tải lên thất bại')
                    return null
                })
                if (signatureResult && !signatureResult.success) {
                    setSignatureError(signatureResult.error)
                    toast.warning(
                        'Thông tin đã được cập nhật nhưng chữ ký tải lên thất bại. ' +
                        signatureResult.error
                    )
                } else if (signatureResult) {
                    toast.success('Đã cập nhật thông tin và chữ ký thành công')
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
                can_access_confidential: canEditConfidentialAccess ? createValues.can_access_confidential ?? false : false,
            }
            if (canConfigureAnalystOtpEmail && createValues.otpEmail) {
                createPayload.otpEmail = createValues.otpEmail
            }

            const result = await createUserClient(createPayload).catch((error) => {
                reportSubmissionError(error)
                return null
            })
            if (!result) {
                setIsSubmitting(false)
                return
            }
            if (hasActionError(result)) {
                form.setError('root', { message: result.error })
                toast.error(result.error)
                setIsSubmitting(false)
                return
            }

            if (createValues.role === 'manager' && signatureFile) {
                const formData = new FormData()
                formData.append('file', signatureFile)

                const signatureResult = await uploadSignatureClient(formData).catch((signatureErr) => {
                    console.error('Signature upload error:', signatureErr)
                    setSignatureError('Tải lên chữ ký thất bại')
                    toast.warning(
                        'Tài khoản đã được tạo nhưng chữ ký tải lên thất bại. ' +
                        'Vui lòng tải lên chữ ký trong Cài đặt.'
                    )
                    return null
                })
                if (signatureResult && !signatureResult.success) {
                    setSignatureError(signatureResult.error)
                    toast.warning(
                        'Tài khoản đã được tạo nhưng chữ ký tải lên thất bại. ' +
                        'Vui lòng tải lên chữ ký trong Cài đặt.'
                    )
                } else if (signatureResult) {
                    toast.success('Đã tạo người dùng mới và tải lên chữ ký thành công')
                }
            } else {
                toast.success('Đã tạo người dùng mới')
            }
        }

        onSuccess()
        setIsSubmitting(false)
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {isOtherEdit && (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                            <strong>Chế độ quản trị:</strong> Bạn có thể chỉnh sửa vai trò và quyền truy cập dữ liệu bí mật của người dùng này.
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

                <UserFormRoleAccessFields
                    control={form.control}
                    showRoleSelector={!isEdit}
                    roleLabel={isEdit ? getUserRoleLabel(user?.role) : undefined}
                    showConfidentialAccess={canEditConfidentialAccess}
                />

                {canConfigureAnalystOtpEmail && (
                    <FormField
                        control={form.control}
                        name="otpEmail"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email nhận OTP</FormLabel>
                                <FormControl>
                                    <Input
                                        type="email"
                                        placeholder="otp@example.com"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    Email nhận mã OTP khi tính năng OTP analyst HIV được bật bởi superadmin.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

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

                <UserFormSignatureSection
                    isEdit={isEdit}
                    isSelfEdit={isSelfEdit}
                    isOtherEdit={isOtherEdit}
                    selectedRole={selectedRole}
                    signatureError={signatureError}
                    signatureFile={signatureFile}
                    userRole={user?.role}
                    onSignatureFileChange={setSignatureFile}
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
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo mới')}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
