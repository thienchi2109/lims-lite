'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
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
import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ResultsGridProps {
    results: ResultWithAssay[]
    sampleId: string
    userRole: 'analyst' | 'manager'
    onSaveSuccess?: () => void
}

type FormValues = {
    results: Array<{
        id: string
        value: string
        originalValue: string
    }>
}

export function ResultsGrid({ results, sampleId, userRole, onSaveSuccess }: ResultsGridProps) {
    const [isSaving, setIsSaving] = useState(false)
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [focusedCellIndex, setFocusedCellIndex] = useState<number | null>(null)

    // Initialize form
    const { control, handleSubmit, watch, reset, formState } = useForm<FormValues>({
        defaultValues: {
            results: results.map((r) => ({
                id: r.id,
                value: r.value || '',
                originalValue: r.value || '',
            })),
        },
    })

    const { fields, update } = useFieldArray({
        control,
        name: 'results',
    })

    // Watch all values to detect changes
    const watchedResults = watch('results')
    const pendingChanges = useMemo(() => {
        return watchedResults.filter((r, index) => r.value !== r.originalValue && !validationErrors[r.id])
    }, [watchedResults, validationErrors])

    // Handle value change with validation
    const handleValueChange = useCallback(
        (index: number, value: string) => {
            const result = results[index]
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
                    next[result.id] = error
                } else {
                    delete next[result.id]
                }
                return next
            })

            return value
        },
        [results]
    )

    // Handle batch save
    const onSubmit = async (data: FormValues) => {
        if (Object.keys(validationErrors).length > 0) {
            toast.error('Please fix validation errors before saving')
            return
        }

        const changedResults = data.results.filter(
            (r, index) => r.value !== r.originalValue
        )

        if (changedResults.length === 0) {
            toast.info('No changes to save')
            return
        }

        setIsSaving(true)

        try {
            const response = await saveBatchResults({
                results: changedResults.map((r) => ({
                    id: r.id,
                    value: r.value,
                })),
            })

            if (response.error) {
                toast.error(response.error)
                return
            }

            toast.success(`Successfully saved ${changedResults.length} result(s)`)

            // Reset form with new values as originals
            reset({
                results: data.results.map((r) => ({
                    ...r,
                    originalValue: r.value,
                })),
            })

            onSaveSuccess?.()
        } catch (error) {
            console.error('Error saving results:', error)
            toast.error('Failed to save results')
        } finally {
            setIsSaving(false)
        }
    }

    // Handle discard
    const handleDiscard = () => {
        reset({
            results: fields.map((f) => ({
                ...f,
                value: f.originalValue,
            })),
        })
        setValidationErrors({})
        toast.info('Changes discarded')
    }

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+S to save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault()
                handleSubmit(onSubmit)()
                return
            }

            if (focusedCellIndex === null) return

            const editableIndices = results
                .map((r, i) => ({ index: i, editable: isEditable(r) }))
                .filter((item) => item.editable)
                .map((item) => item.index)

            const currentPosition = editableIndices.indexOf(focusedCellIndex)

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault()
                    if (currentPosition < editableIndices.length - 1) {
                        setFocusedCellIndex(editableIndices[currentPosition + 1])
                    }
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    if (currentPosition > 0) {
                        setFocusedCellIndex(editableIndices[currentPosition - 1])
                    }
                    break
                case 'Tab':
                    e.preventDefault()
                    if (e.shiftKey) {
                        if (currentPosition > 0) {
                            setFocusedCellIndex(editableIndices[currentPosition - 1])
                        }
                    } else {
                        if (currentPosition < editableIndices.length - 1) {
                            setFocusedCellIndex(editableIndices[currentPosition + 1])
                        }
                    }
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [focusedCellIndex, results, handleSubmit, onSubmit])

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
    const isEditable = (result: ResultWithAssay) => {
        if (userRole === 'manager') return true
        return result.status !== 'approved'
    }

    // Define columns
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
                    const index = results.findIndex((r) => r.id === row.original.id)
                    const field = fields[index]
                    const isPending = field?.value !== field?.originalValue

                    return (
                        <Controller
                            name={`results.${index}.value`}
                            control={control}
                            render={({ field: controllerField }) => (
                                <ResultCellEditor
                                    value={controllerField.value || ''}
                                    onChange={(value) => {
                                        handleValueChange(index, value)
                                        controllerField.onChange(value)
                                    }}
                                    isEditable={isEditable(row.original)}
                                    validationError={validationErrors[row.original.id]}
                                    isPending={isPending}
                                    units={row.original.assay_units}
                                    autoFocus={focusedCellIndex === index}
                                />
                            )}
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
        [results, fields, validationErrors, focusedCellIndex]
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
                onSave={handleSubmit(onSubmit)}
                onDiscard={handleDiscard}
                isSaving={isSaving}
                isVisible={pendingChanges.length > 0}
            />
        </div>
    )
}
