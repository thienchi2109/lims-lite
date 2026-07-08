'use client'

import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { AssayDefinition } from './assay-definition-dialog/types'

type Props = {
    assay: AssayDefinition
    onView: (assay: AssayDefinition) => void
    onEdit: (assay: AssayDefinition) => void
    onDelete: (assay: AssayDefinition) => void
}

export function AssayDefinitionRowActions({ assay, onView, onEdit, onDelete }: Props) {
    return (
        <div className="flex items-center justify-end gap-2">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                onClick={() => onView(assay)}
                aria-label="Xem chi tiết chỉ tiêu"
            >
                <Eye className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => onEdit(assay)}
                aria-label="Sửa chỉ tiêu"
            >
                <Pencil className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => onDelete(assay)}
                aria-label="Xóa chỉ tiêu"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    )
}
