'use client'

import { useState } from 'react'
import { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { UserDialog } from '@/components/user-dialog'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SearchInput } from '@/components/ui/search-input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { deleteUserClient } from '@/lib/api-client'

interface UserListTableProps {
    users: User[]
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
}

export function UserListTable({
    users,
    page,
    pageSize,
    totalPages,
    totalCount,
}: UserListTableProps) {
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const updateQuery = (newPage: number, newPageSize: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(newPage))
        params.set('pageSize', String(newPageSize))
        router.replace(`${pathname}?${params.toString()}`)
    }

    const handleDelete = async (user: User) => {
        if (confirm(`Bạn có chắc chắn muốn xóa người dùng ${user.username}?`)) {
            try {
                const result = await deleteUserClient(user.id)
                if (result?.error) {
                    throw new Error(result.error)
                }
                router.refresh()
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Không thể xóa người dùng'
                alert(message)
            }
        }
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
                            <TableHead className="w-[100px]">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Không tìm thấy người dùng nào.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium font-mono">
                                        {user.username}
                                    </TableCell>
                                    <TableCell>{user.full_name}</TableCell>
                                    <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                                    <TableCell className="text-muted-foreground">{user.lab || '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'manager' ? 'default' : 'secondary'} className="capitalize">
                                            {user.role === 'manager' ? 'Quản lý' : 'Kỹ thuật viên'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditingUser(user)}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Pencil className="h-4 w-4 text-slate-500" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(user)}
                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
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
            />

            {editingUser && (
                <UserDialog
                    open={!!editingUser}
                    onOpenChange={(open) => !open && setEditingUser(null)}
                    mode="edit"
                    user={editingUser}
                />
            )}
        </div>
    )
}