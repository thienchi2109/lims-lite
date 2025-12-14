'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { UserForm } from './user-form'
import { User } from '@/types'

interface UserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: 'create' | 'edit'
    user?: User
}

export function UserDialog({ open, onOpenChange, mode, user }: UserDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Thêm người dùng' : 'Sửa người dùng'}</DialogTitle>
                    <DialogDescription>
                         {mode === 'create' ? 'Tạo tài khoản mới cho nhân viên.' : 'Cập nhật thông tin tài khoản.'}
                    </DialogDescription>
                </DialogHeader>
                <UserForm 
                    user={user} 
                    onSuccess={() => onOpenChange(false)} 
                    onCancel={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    )
}
