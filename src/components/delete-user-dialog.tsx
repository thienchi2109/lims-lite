'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { User } from '@/types'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteUserClient } from '@/lib/api-client'

const fallbackDeleteError = 'Không thể xóa người dùng'

function getDeleteErrorMessage(result: unknown) {
    if (!result || typeof result !== 'object') {
        return null
    }

    if ('error' in result) {
        const error = (result as { error?: unknown }).error
        return typeof error === 'string' && error.length > 0
            ? error
            : fallbackDeleteError
    }

    if ('success' in result && (result as { success?: unknown }).success === false) {
        return fallbackDeleteError
    }

    return null
}

interface DeleteUserDialogProps {
    open: boolean
    user: User
    returnFocusTarget: HTMLButtonElement | null
    onOpenChange: (open: boolean) => void
}

export function DeleteUserDialog({
    open,
    user,
    returnFocusTarget,
    onOpenChange,
}: DeleteUserDialogProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const handleOpenChange = (nextOpen: boolean) => {
        if (isPending && !nextOpen) {
            return
        }

        onOpenChange(nextOpen)
    }

    const handleDelete = () => {
        if (isPending) {
            return
        }

        startTransition(async () => {
            try {
                const result = await deleteUserClient(user.id)
                const errorMessage = getDeleteErrorMessage(result)

                if (errorMessage) {
                    toast.error(errorMessage)
                    return
                }

                toast.success(`Đã xóa người dùng ${user.username}`)
                onOpenChange(false)
                router.refresh()
            } catch (error) {
                toast.error(
                    error instanceof Error && error.message
                        ? error.message
                        : fallbackDeleteError,
                )
            }
        })
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent
                onCloseAutoFocus={(event) => {
                    event.preventDefault()
                    returnFocusTarget?.focus()
                }}
                onEscapeKeyDown={(event) => {
                    if (isPending) {
                        event.preventDefault()
                    }
                }}
            >
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Xác nhận xóa người dùng
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Tài khoản {user.full_name} ({user.username}) sẽ bị vô hiệu hóa,
                        không thể đăng nhập và dữ liệu lịch sử vẫn được giữ lại.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>
                        Hủy
                    </AlertDialogCancel>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={isPending}
                        onClick={handleDelete}
                    >
                        {isPending && (
                            <Loader2
                                className="mr-2 h-4 w-4 animate-spin"
                                aria-hidden="true"
                            />
                        )}
                        {isPending ? 'Đang xóa...' : 'Xóa người dùng'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
