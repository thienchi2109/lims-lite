'use client'

import { useRef } from 'react'
import { KeyRound, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { User } from '@/types'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'

interface UserRowActionsProps {
    user: User
    isRestrictedManagerRow: boolean
    canConfigureOtpEmail: boolean
    onEdit: (user: User) => void
    onConfigureOtpEmail: (user: User) => void
    onRequestDelete: (
        user: User,
        returnFocusTarget: HTMLButtonElement | null,
    ) => void
}

export function UserRowActions({
    user,
    isRestrictedManagerRow,
    canConfigureOtpEmail,
    onEdit,
    onConfigureOtpEmail,
    onRequestDelete,
}: UserRowActionsProps) {
    const overflowTriggerRef = useRef<HTMLButtonElement>(null)
    const editTooltip = isRestrictedManagerRow
        ? 'Không thể sửa tài khoản quản lý khác.'
        : 'Sửa người dùng'

    return (
        <div className="flex items-center justify-end gap-1">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                        aria-label={`Sửa người dùng ${user.username}`}
                        aria-disabled={isRestrictedManagerRow}
                        onClick={() => {
                            if (!isRestrictedManagerRow) {
                                onEdit(user)
                            }
                        }}
                    >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                    {editTooltip}
                </TooltipContent>
            </Tooltip>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        ref={overflowTriggerRef}
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Mở menu thao tác cho ${user.username}`}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {canConfigureOtpEmail && (
                        <>
                            <DropdownMenuItem
                                onSelect={() => onConfigureOtpEmail(user)}
                            >
                                <KeyRound />
                                Cấu hình email OTP
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    <DropdownMenuItem
                        variant="destructive"
                        disabled={isRestrictedManagerRow}
                        onSelect={() => {
                            onRequestDelete(user, overflowTriggerRef.current)
                        }}
                    >
                        <Trash2 />
                        Xóa người dùng
                    </DropdownMenuItem>
                    {isRestrictedManagerRow && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="whitespace-normal text-xs font-normal text-muted-foreground">
                                Tài khoản quản lý khác được bảo vệ.
                            </DropdownMenuLabel>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
