'use client'

import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    onPageChange: (page: number, pageSize: number) => void
}

export function AssayDefinitionsPagination({
    page,
    pageSize,
    totalPages,
    totalCount,
    onPageChange,
}: Props) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Hiển thị</span>
                <Select
                    value={String(pageSize)}
                    onValueChange={(value) => onPageChange(1, Number(value))}
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
                    {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} của{' '}
                    {totalCount} chỉ tiêu
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.max(1, page - 1), pageSize)}
                    disabled={page === 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                    Trước
                </Button>
                <div className="text-sm font-medium min-w-[3rem] text-center">
                    Trang {page} / {totalPages}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.min(totalPages, page + 1), pageSize)}
                    disabled={page === totalPages}
                >
                    Tiếp
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
