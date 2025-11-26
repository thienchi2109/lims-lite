'use client'

import { useState, useEffect } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
} from '@tanstack/react-table'
import { getSamples, updateSample } from '@/app/actions/samples'
import { type SampleWithUser, type SampleStatus } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { EditableCell } from '@/components/editable-cell'
import { TestAssignmentDialog } from '@/components/test-assignment-dialog'
import { Loader2, ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react'

interface SampleListTableProps {
    isManager?: boolean
}

export function SampleListTable({ isManager = false }: SampleListTableProps) {
    const [samples, setSamples] = useState<SampleWithUser[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Pagination state
    const [page, setPage] = useState(1)
    const [pageSize] = useState(20)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)

    // Filter state
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<SampleStatus | 'all'>('all')

    // Dialog state
    const [assignDialogOpen, setAssignDialogOpen] = useState(false)
    const [selectedSample, setSelectedSample] = useState<SampleWithUser | null>(null)

    // Load samples
    const loadSamples = async () => {
        setIsLoading(true)
        setError(null)

        const result = await getSamples({
            page,
            pageSize,
            search: search || undefined,
            status: statusFilter === 'all' ? undefined : statusFilter,
            sortBy: 'created_at',
            sortOrder: 'desc',
        })

        if (result.error) {
            setError(result.error)
        } else {
            setSamples(result.data || [])
            setTotalPages(result.totalPages || 1)
            setTotalCount(result.count || 0)
        }

        setIsLoading(false)
    }

    // Reload on filter/page change
    useEffect(() => {
        loadSamples()
    }, [page, statusFilter])

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1) // Reset to first page on search
            loadSamples()
        }, 500)

        return () => clearTimeout(timer)
    }, [search])

    const handleUpdateCell = async (sampleId: string, field: 'client_name', value: string) => {
        const result = await updateSample({
            id: sampleId,
            [field]: value,
        })

        if (!result.error) {
            // Update local state
            setSamples((prev) =>
                prev.map((s) => (s.id === sampleId ? { ...s, [field]: value } : s))
            )
        }

        return result
    }

    const handleAssignTests = (sample: SampleWithUser) => {
        setSelectedSample(sample)
        setAssignDialogOpen(true)
    }

    const columns: ColumnDef<SampleWithUser>[] = [
        {
            accessorKey: 'sample_id',
            header: 'Sample ID',
            cell: ({ row }) => (
                <span className="font-mono font-medium">{row.original.sample_id}</span>
            ),
        },
        {
            accessorKey: 'client_name',
            header: 'Client Name',
            cell: ({ row }) => (
                <EditableCell
                    value={row.original.client_name || ''}
                    onSave={(newValue) =>
                        handleUpdateCell(row.original.id, 'client_name', newValue)
                    }
                    disabled={!isManager && row.original.status !== 'received'}
                />
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => <SampleStatusBadge status={row.original.status} />,
        },
        {
            accessorKey: 'received_at',
            header: 'Received At',
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {formatDate(row.original.received_at)}
                </span>
            ),
        },
        {
            accessorKey: 'received_by_name',
            header: 'Received By',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.received_by_name || 'N/A'}</span>
            ),
        },
    ]

    // Add actions column for managers
    if (isManager) {
        columns.push({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignTests(row.original)}
                    disabled={row.original.status === 'completed'}
                >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    Assign Tests
                </Button>
            ),
        })
    }

    const table = useReactTable({
        data: samples,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    })

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <Input
                        placeholder="Search by sample ID or client name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as SampleStatus | 'all')}
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-destructive">{error}</div>
                ) : samples.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        No samples found. Create your first sample to get started.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
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
                            {table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Pagination */}
            {!isLoading && samples.length > 0 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {(page - 1) * pageSize + 1} to{' '}
                        {Math.min(page * pageSize, totalCount)} of {totalCount} samples
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <div className="text-sm">
                            Page {page} of {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Test Assignment Dialog */}
            {selectedSample && (
                <TestAssignmentDialog
                    sampleId={selectedSample.id}
                    sampleName={selectedSample.sample_id}
                    open={assignDialogOpen}
                    onOpenChange={setAssignDialogOpen}
                    onSuccess={loadSamples}
                />
            )}
        </div>
    )
}
