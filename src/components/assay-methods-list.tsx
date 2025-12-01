'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Plus, Star, Trash2, Check } from 'lucide-react'
import { setDefaultMethod, removeMethodFromAssay } from '@/app/actions/assay-methods'
import { AddMethodToAssayDialog } from './add-method-to-assay-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type AssayMethod = {
    id: string
    method_id: string
    name: string
    is_default: boolean
    notes: string | null
}

type Props = {
    assayId: string
    methods: AssayMethod[]
}

export function AssayMethodsList({ assayId, methods }: Props) {
    const [isPending, startTransition] = useTransition()
    const [showAddDialog, setShowAddDialog] = useState(false)

    const handleSetDefault = (methodId: string) => {
        startTransition(async () => {
            const result = await setDefaultMethod(assayId, methodId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Đã đặt phương pháp mặc định thành công')
            }
        })
    }

    const handleRemove = (assayMethodId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phương pháp này khỏi chỉ tiêu?')) return

        startTransition(async () => {
            const result = await removeMethodFromAssay(assayMethodId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Đã xóa phương pháp thành công')
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Danh sách phương pháp</h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddDialog(true)}
                    className="h-8"
                >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Thêm phương pháp
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tên phương pháp</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Ghi chú</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {methods.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                    Chưa có phương pháp nào được gán
                                </TableCell>
                            </TableRow>
                        ) : (
                            methods.map((method) => (
                                <TableRow key={method.id}>
                                    <TableCell className="font-medium">
                                        {method.name}
                                    </TableCell>
                                    <TableCell>
                                        {method.is_default && (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                <Check className="mr-1 h-3 w-3" /> Mặc định
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {method.notes || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {!method.is_default && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleSetDefault(method.method_id)}
                                                        disabled={isPending}
                                                    >
                                                        <Star className="mr-2 h-4 w-4" />
                                                        Đặt làm mặc định
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    onClick={() => handleRemove(method.id)}
                                                    disabled={isPending || methods.length <= 1}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Xóa khỏi chỉ tiêu
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AddMethodToAssayDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                assayId={assayId}
                existingMethodIds={methods.map((m) => m.method_id)}
            />
        </div>
    )
}
