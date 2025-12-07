'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, PencilLine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditableCellProps {
    value: string
    onSave: (newValue: string) => Promise<{ error?: string }>
    disabled?: boolean
}

export function EditableCell({ value, onSave, disabled = false }: EditableCellProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [currentValue, setCurrentValue] = useState(value)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSave = async () => {
        if (currentValue === value) {
            setIsEditing(false)
            return
        }

        setIsSaving(true)
        setError(null)

        const result = await onSave(currentValue)

        if (result.error) {
            setError(result.error)
            setCurrentValue(value) // Reset to original value
        } else {
            setIsEditing(false)
        }

        setIsSaving(false)
    }

    const handleCancel = () => {
        setCurrentValue(value)
        setIsEditing(false)
        setError(null)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave()
        } else if (e.key === 'Escape') {
            handleCancel()
        }
    }

    if (disabled) {
        return <span className="text-muted-foreground">{value}</span>
    }

    if (!isEditing) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                }}
                className="group relative w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-inner transition hover:border-sky-400 hover:ring-1 hover:ring-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500 dark:hover:ring-sky-800"
                title="Chỉnh sửa tên khách hàng"
                data-stop-row-click="true"
            >
                <span
                    className={cn(
                        'block truncate pr-6 text-sm text-slate-800 dark:text-slate-100',
                        !value && 'italic text-slate-400 dark:text-slate-500'
                    )}
                >
                    {value || 'Nhập tên khách hàng'}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-300 transition group-hover:text-sky-500 dark:text-slate-600 dark:group-hover:text-sky-400">
                    <PencilLine className="h-4 w-4" />
                </span>
            </button>
        )
    }

    return (
        <div
            className="space-y-1"
            data-stop-row-click="true"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="relative flex items-center">
                <Input
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    autoFocus
                    disabled={isSaving}
                    className="h-9 pr-10 font-medium transition-all focus-visible:ring-2 focus-visible:ring-sky-500/30 focus-visible:border-sky-500"
                    placeholder="Nhập tên khách hàng..."
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                    {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                        <PencilLine className="h-4 w-4" />
                    )}
                </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    )
}
