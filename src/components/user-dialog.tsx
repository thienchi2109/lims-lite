'use client'

import {
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { FormDialogContent } from '@/components/ui/form-dialog-content'
import { UserForm } from './user-form'
import { User } from '@/types'

interface UserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: 'create' | 'edit'
    user?: User
    currentUserId?: string
    currentUserRole?: User['role']
}

export function UserDialog({
    open,
    onOpenChange,
    mode,
    user,
    currentUserId,
    currentUserRole,
}: UserDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <FormDialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Thêm người dùng' : 'Sửa người dùng'}</DialogTitle>
                    <DialogDescription>
                         {mode === 'create' ? 'Tạo tài khoản mới cho nhân viên.' : 'Cập nhật thông tin tài khoản.'}
                    </DialogDescription>
                </DialogHeader>
                <UserForm
                    user={user}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onSuccess={() => onOpenChange(false)}
                    onCancel={() => onOpenChange(false)}
                />
            </FormDialogContent>
        </Dialog>
    )
}
