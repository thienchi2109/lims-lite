'use client'

import type { Control } from 'react-hook-form'
import {
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
import { USER_ROLE_OPTIONS } from '@/lib/role-labels'

interface UserFormRoleAccessFieldsProps {
    control: Control
    showRoleSelector?: boolean
    roleLabel?: string
    showConfidentialAccess?: boolean
}

export function UserFormRoleAccessFields({
    control,
    showRoleSelector = true,
    roleLabel,
    showConfidentialAccess = true,
}: UserFormRoleAccessFieldsProps) {
    return (
        <>
            {showRoleSelector ? (
                <FormField
                    control={control}
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
                                    {USER_ROLE_OPTIONS.map((roleOption) => (
                                        <SelectItem key={roleOption.value} value={roleOption.value}>
                                            {roleOption.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            ) : (
                <div className="space-y-2">
                    <FormLabel>Vai trò</FormLabel>
                    <Input
                        aria-label="Vai trò"
                        value={roleLabel ?? ''}
                        readOnly
                    />
                </div>
            )}

            {showConfidentialAccess ? (
                <FormField
                    control={control}
                    name="can_access_confidential"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <FormLabel>Có quyền truy cập dữ liệu bí mật</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                    Cho phép người dùng xem và xử lý các chỉ tiêu bí mật.
                                </div>
                            </div>
                            <FormControl>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-label="Có quyền truy cập dữ liệu bí mật"
                                    aria-checked={Boolean(field.value)}
                                    onClick={() => field.onChange(!field.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === ' ' || event.key === 'Enter') {
                                            event.preventDefault()
                                            field.onChange(!field.value)
                                        }
                                    }}
                                    className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                        field.value ? 'bg-primary' : 'bg-input'
                                    }`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${
                                            field.value ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </FormControl>
                        </FormItem>
                    )}
                />
            ) : (
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    Quyền truy cập dữ liệu bí mật chỉ do quản trị viên hệ thống cấu hình ngoài ứng dụng.
                </div>
            )}
        </>
    )
}
