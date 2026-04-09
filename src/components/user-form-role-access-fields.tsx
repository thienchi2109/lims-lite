'use client'

import type { Control } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
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
}

export function UserFormRoleAccessFields({ control }: UserFormRoleAccessFieldsProps) {
    return (
        <>
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
                            <Checkbox
                                checked={Boolean(field.value)}
                                onCheckedChange={(checked) => field.onChange(checked === true)}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        </>
    )
}
