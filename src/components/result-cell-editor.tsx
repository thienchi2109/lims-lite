'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Lock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultCellEditorProps {
    value: string
    onChange: (value: string) => void
    onBlur?: () => void
    isEditable: boolean
    validationError?: string | null
    isPending?: boolean
    units?: string | null
    autoFocus?: boolean
}

export function ResultCellEditor({
    value,
    onChange,
    onBlur,
    isEditable,
    validationError,
    isPending = false,
    units,
    autoFocus = false,
}: ResultCellEditorProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isFocused, setIsFocused] = useState(false)

    useEffect(() => {
        if (autoFocus && inputRef.current && isEditable) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [autoFocus, isEditable])

    if (!isEditable) {
        return (
            <div className="relative flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <Lock className="h-3 w-3 flex-shrink-0" />
                <span className={cn('flex-1', !value && 'italic text-slate-400')}>
                    {value || 'N/A'}
                </span>
                {units && <span className="text-xs text-slate-500">{units}</span>}
            </div>
        )
    }

    return (
        <div className="relative">
            <Input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => {
                    setIsFocused(false)
                    onBlur?.()
                }}
                onFocus={() => setIsFocused(true)}
                disabled={!isEditable}
                className={cn(
                    'pr-16 transition-all duration-200',
                    validationError &&
                    'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500 dark:bg-red-950/20',
                    isPending &&
                    !validationError &&
                    'border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-500 dark:bg-amber-950/20',
                    isFocused && !validationError && !isPending && 'ring-2 ring-blue-500/20',
                    'font-mono'
                )}
                placeholder="Enter value..."
            />

            {/* Actions/Indicators */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
                {validationError && (
                    <div className="group relative">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <div className="absolute bottom-full right-0 mb-2 hidden w-48 rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                            {validationError}
                        </div>
                    </div>
                )}
                {units && !validationError && (
                    <span className="text-xs font-medium text-slate-500">{units}</span>
                )}
            </div>
        </div>
    )
}
