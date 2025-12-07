'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, Check, X } from 'lucide-react'
import { debounce } from '@/lib/utils-lims'

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
            <div
                onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                }}
                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded min-h-[2rem] flex items-center"
                title="Click to edit"
                data-stop-row-click="true"
            >
                {value || <span className="text-muted-foreground italic">Click to edit</span>}
            </div>
        )
    }

    return (
        <div
            className="space-y-1"
            data-stop-row-click="true"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-2">
                <Input
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    autoFocus
                    disabled={isSaving}
                    className="h-8"
                />
                {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    )
}
