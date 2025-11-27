'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
} from '@tanstack/react-table'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { ResultCellEditor } from '@/components/result-cell-editor'
import { ResultStatusBadge } from '@/components/result-status-badge'
import { BatchSaveToolbar } from '@/components/batch-save-toolbar'
import { saveBatchResults } from '@/app/actions/results'
import { validateNumericValue, validateTextValue, formatRelativeTime } from '@/lib/utils-lims'
import { type ResultWithAssay } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ResultsGridProps {
    results: ResultWithAssay[]
    sampleId: string
    userRole: 'analyst' | 'manager'
    onSaveSuccess?: () => void
}

type ResultValue = {
    id: string
    value: string
    originalValue: string
}

export function ResultsGrid({ results, sampleId: _sampleId, userRole, onSaveSuccess }: ResultsGridProps) {
    const [isSaving, setIsSaving] = useState(false)
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [activeResultId, setActiveResultId] = useState<string | null>(null)
    const resultValuesRef = useRef<Record<string, ResultValue>>({})
    const validationErrorsRef = useRef<Record<string, string>>({})

    // Use local state for values to prevent re-renders
    const [resultValues, setResultValues] = useState<Record<string, ResultValue>>(() => {
        const initial: Record<string, ResultValue> = {}
        results.forEach((r) => {
            initial[r.id] = {
                id: r.id,
                value: r.value || '',
                originalValue: r.value || '',
            }
        })
        resultValuesRef.current = initial
        return initial
    })
    validationErrorsRef.current = validationErrors
    resultValuesRef.current = resultValues

    // Keep local state in sync when results prop changes without blowing away unsaved edits
    useEffect(() => {
        setResultValues((prev) => {
            const next: Record<string, ResultValue> = {}
            results.forEach((r) => {
                const incoming = r.value || ''
                const existing = prev[r.id]
                const isDirty = existing ? existing.value !== existing.originalValue : false

                next[r.id] = {
                    id: r.id,
                    value: isDirty && existing ? existing.value : incoming,
                    originalValue: incoming,
                }
            })
            return next
        })

        setValidationErrors((prev) => {
            const next: Record<string, string> = {}
            results.forEach((r) => {
                if (prev[r.id]) {
                    next[r.id] = prev[r.id]
                }
            })
            return next
        })

        setActiveResultId((current) =>
            current && results.some((r) => r.id === current) ? current : null
        )
    }, [results])

    // Calculate pending changes
    const pendingChanges = useMemo(() => {
        return Object.values(resultValues).filter(
            (rv) => rv.value !== rv.originalValue && !validationErrors[rv.id]
        )
    }, [resultValues, validationErrors])

    // Handle value change with validation
    const handleValueChange = useCallback(
        (resultId: string, value: string) => {
            const result = results.find((r) => r.id === resultId)
            if (!result) return

            const rules = result.validation_rules || {}

            // Perform client-side validation
            let error: string | null = null
            if (rules.type === 'numeric' || rules.min !== undefined || rules.max !== undefined) {
                error = validateNumericValue(value, rules)
            } else {
                error = validateTextValue(value, rules)
            }

            // Update validation errors
            setValidationErrors((prev) => {
                const next = { ...prev }
                if (error) {
                    next[resultId] = error
                } else {
                    delete next[resultId]
                }
                return next
            })

            // Update value
            setResultValues((prev) => ({
                ...prev,
                [resultId]: {
                    ...prev[resultId],
                    value,
                },
            }))
        },
        [results]
    )

    // Handle batch save
    const handleSave = useCallback(async () => {
        if (Object.keys(validationErrors).length > 0) {
            toast.error('Please fix validation errors before saving')
            return
        }

        const changedResults = pendingChanges.map((rv) => ({
            id: rv.id,
            value: rv.value,
        }))

        if (changedResults.length === 0) {
            toast.info('No changes to save')
            return
        }

        setIsSaving(true)

        try {
            const response = await saveBatchResults({
                results: changedResults,
            })

            if (response.error) {
                toast.error(response.error)
                return
            }

            toast.success(`Successfully saved ${changedResults.length} result(s)`)

            // Update original values
            setResultValues((prev) => {
                const next = { ...prev }
                changedResults.forEach((cr) => {
                    next[cr.id].originalValue = cr.value
                })
                return next
            })

            onSaveSuccess?.()
        } catch (error) {
            console.error('Error saving results:', error)
            toast.error('Failed to save results')
        } finally {
            setIsSaving(false)
        }
    }, [pendingChanges, validationErrors, onSaveSuccess])

    // Handle discard
    const handleDiscard = () => {
        setResultValues((prev) => {
            const next = { ...prev }
            Object.keys(next).forEach((id) => {
                next[id].value = next[id].originalValue
            })
            return next
        })
        setValidationErrors({})
        toast.info('Changes discarded')
    }

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+S to save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [pendingChanges, validationErrors, handleSave])

    // Warn before unload if there are pending changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (pendingChanges.length > 0) {
                e.preventDefault()
                e.returnValue = ''
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [pendingChanges])

    // Helper to determine if cell is editable
    const isEditable = useCallback((result: ResultWithAssay) => {
        if (userRole === 'manager') return true
        return result.status !== 'approved'
    }, [userRole])

    // Define columns - memoized with stable dependencies
    const columns = useMemo<ColumnDef<ResultWithAssay>[]>(
        () => [
            {
                accessorKey: 'sample_id_display',
                header: 'Sample ID',
                cell: ({ row }) => (
                    <div className="font-mono text-sm font-medium">
                        {row.original.sample_id_display}
                    </div>
                ),
            },
            {
                accessorKey: 'assay_name',
                header: 'Assay',
                cell: ({ row }) => (
                    <div className="font-semibold">{row.original.assay_name}</div>
                ),
            },
            {
                accessorKey: 'method_name',
                header: 'Method',
                cell: ({ row }) => (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        {row.original.method_name || 'N/A'}
                    </div>
                ),
            },
            {
                id: 'value',
                accessorKey: 'value',
                header: 'Result Value',
                cell: ({ row }) => {
                    const resultValue = resultValuesRef.current[row.original.id]
                    const isPending = resultValue?.value !== resultValue?.originalValue
                    const error = validationErrorsRef.current[row.original.id]

                    return (
                        <ResultCellEditor
                            key={row.original.id}
                            value={resultValue?.value || ''}
                            onChange={(value) => handleValueChange(row.original.id, value)}
                            isEditable={isEditable(row.original)}
                            validationError={error}
                            isPending={isPending}
                            units={row.original.assay_units}
                            onFocus={() => setActiveResultId(row.original.id)}
                            onBlur={() => setActiveResultId(null)}
                            autoFocus={activeResultId === row.original.id}
                        />
                    )
                },
            },
            {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => <ResultStatusBadge status={row.original.status} />,
            },
            {
                accessorKey: 'entered_by_name',
                header: 'Entered By',
                cell: ({ row }) => {
                    if (!row.original.entered_by_name) return <span className="text-sm text-slate-400">—</span>

                    const initials = row.original.entered_by_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()

                    return (
                        <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{row.original.entered_by_name}</span>
                        </div>
                    )
                },
            },
            {
                accessorKey: 'entered_at',
                header: 'Entered At',
                cell: ({ row }) =>
                    row.original.entered_at ? (
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            {formatRelativeTime(row.original.entered_at)}
                        </span>
                    ) : (
                        <span className="text-sm text-slate-400">—</span>
                    ),
            },
        ],
        [results, handleValueChange, isEditable, activeResultId]
    )

    const table = useReactTable({
        data: results,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    if (results.length === 0) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 dark:border-slate-700">
                <AlertCircle className="mb-4 h-12 w-12 text-slate-400" />
                <h3 className="mb-2 text-lg font-semibold text-slate-700 dark:text-slate-300">
                    No Tests Assigned
                </h3>
                <p className="text-center text-sm text-slate-500">
                    This sample has no tests assigned yet. Manager must assign tests before results can be entered.
                </p>
            </div>
        )
    }

    return (
        <div className="relative">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow
                                key={headerGroup.id}
                                className="bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 dark:from-slate-900 dark:to-slate-800 dark:hover:from-slate-800 dark:hover:to-slate-700"
                            >
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="font-semibold">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.map((row, index) => (
                            <TableRow
                                key={row.id}
                                className={cn(
                                    'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                                    index % 2 === 0 && 'bg-white dark:bg-slate-900',
                                    index % 2 === 1 && 'bg-slate-50/30 dark:bg-slate-800/30'
                                )}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className="px-4 py-3">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <BatchSaveToolbar
                pendingCount={pendingChanges.length}
                onSave={handleSave}
                onDiscard={handleDiscard}
                isSaving={isSaving}
                isVisible={pendingChanges.length > 0}
            />
        </div>
    )
}
