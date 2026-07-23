'use client'

import { useState } from 'react'
import type { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Plus, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DeleteUserDialog } from '@/components/delete-user-dialog'
import { UserDialog } from '@/components/user-dialog'
import { ManagerOtpEmailDialog } from '@/components/manager-otp-email-dialog'
import { UserRowActions } from '@/components/user-row-actions'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SearchInput } from '@/components/ui/search-input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { getUserRoleLabel } from '@/lib/role-labels'
import {
    canOwnElectronicSignature,
    getSignatureReadinessTitle,
    hasActiveElectronicSignature,
} from '@/lib/signature-readiness'

interface UserListTableProps {
    users: User[]
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    currentUserId?: string
    currentUserRole?: User['role']
}

export function UserListTable({
    users,
    page,
    pageSize,
    totalPages,
    totalCount,
    currentUserId,
    currentUserRole,
}: UserListTableProps) {
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [otpEmailUser, setOtpEmailUser] = useState<User | null>(null)
    const [deleteRequest, setDeleteRequest] = useState<{
        user: User
        returnFocusTarget: HTMLButtonElement | null
    } | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const updateQuery = (newPage: number, newPageSize: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(newPage))
        params.set('pageSize', String(newPageSize))
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 items-center gap-4">
                    <SearchInput placeholder="Tìm kiếm người dùng..." className="w-full md:w-72" />
                    <p className="text-sm text-muted-foreground hidden md:block border-l pl-4">
                        Tổng số: <span className="font-semibold">{totalCount}</span> người dùng
                    </p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm người dùng
                </Button>
            </div>

            <div className="border rounded-lg bg-white dark:bg-slate-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tên đăng nhập</TableHead>
                            <TableHead>Họ và tên</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phòng Lab</TableHead>
                            <TableHead>Vai trò</TableHead>
                            <TableHead className="w-[80px] text-center">Chữ ký</TableHead>
                            <TableHead className="sticky right-0 z-20 w-[104px] min-w-[104px] max-w-[104px] border-l bg-background text-right">
                                Thao tác
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Không tìm thấy người dùng nào.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => {
                                const requiresSignature = canOwnElectronicSignature(user.role)
                                const hasSignature = requiresSignature &&
                                    hasActiveElectronicSignature(user.user_signatures)
                                const isRestrictedManagerRow = currentUserRole === 'manager' &&
                                    user.role === 'manager' &&
                                    user.id !== currentUserId
                                const canConfigureOtpEmail = user.role === 'analyst' ||
                                    (user.role === 'manager' && user.id !== currentUserId)

                                return (
                                <TableRow key={user.id} className="group">
                                    <TableCell className="font-medium font-mono">
                                        {user.username}
                                    </TableCell>
                                    <TableCell>{user.full_name}</TableCell>
                                    <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                                    <TableCell className="text-muted-foreground">{user.lab || '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'manager' ? 'default' : 'secondary'} className="capitalize">
                                            {getUserRoleLabel(user.role)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {requiresSignature ? (
                                            hasSignature ? (
                                                <div
                                                    className="flex justify-center"
                                                    title={getSignatureReadinessTitle(user.full_name, true)}
                                                    aria-label={getSignatureReadinessTitle(user.full_name, true)}
                                                >
                                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex justify-center"
                                                    title={getSignatureReadinessTitle(user.full_name, false)}
                                                    aria-label={getSignatureReadinessTitle(user.full_name, false)}
                                                >
                                                    <XCircle className="h-5 w-5 text-slate-300" />
                                                </div>
                                            )
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="sticky right-0 z-10 w-[104px] min-w-[104px] max-w-[104px] border-l bg-background group-hover:bg-muted/50">
                                        <UserRowActions
                                            user={user}
                                            isRestrictedManagerRow={isRestrictedManagerRow}
                                            canConfigureOtpEmail={canConfigureOtpEmail}
                                            onEdit={setEditingUser}
                                            onConfigureOtpEmail={setOtpEmailUser}
                                            onRequestDelete={(selectedUser, returnFocusTarget) => {
                                                setDeleteRequest({
                                                    user: selectedUser,
                                                    returnFocusTarget,
                                                })
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Hiển thị</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => updateQuery(1, Number(value))}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 20, 50, 100].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span>
                        {(page - 1) * pageSize + 1} -{' '}
                        {Math.min(page * pageSize, totalCount)} của {totalCount}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuery(Math.max(1, page - 1), pageSize)}
                        disabled={page === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Trước
                    </Button>
                    <div className="text-sm">
                        Trang {page} của {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuery(Math.min(totalPages, page + 1), pageSize)}
                        disabled={page === totalPages}
                    >
                        Tiếp
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <UserDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                mode="create"
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
            />

            {editingUser && (
                <UserDialog
                    open={!!editingUser}
                    onOpenChange={(open) => !open && setEditingUser(null)}
                    mode="edit"
                    user={editingUser}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                />
            )}

            <ManagerOtpEmailDialog
                open={!!otpEmailUser}
                onOpenChange={(open) => !open && setOtpEmailUser(null)}
                user={otpEmailUser}
            />

            {deleteRequest && (
                <DeleteUserDialog
                    open
                    user={deleteRequest.user}
                    returnFocusTarget={deleteRequest.returnFocusTarget}
                    onOpenChange={(open) => {
                        if (!open) {
                            setDeleteRequest(null)
                        }
                    }}
                />
            )}
        </div>
    )
}
