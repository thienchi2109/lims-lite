'use client'

import { useState } from 'react'
import {
    type ColumnDef,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ClipboardPen, FileSearch } from 'lucide-react'
import { CoAActionButton } from '@/components/coa-action-button'
import { type CoAReportStatus } from '@/types'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    SampleDataGrid,
    SampleIdCell,
    ClientNameCell,
    StatusCell,
    DateCell,
    CoAStatusCell,
    ProgressCell,
    GRID_LABELS,
    type SampleGridRow,
} from '@/components/sample-grid'

// Type for approval queue data - extends base SampleGridRow
interface ApprovalQueueSample extends SampleGridRow {
    client_name: string | null
    received_at: string | null
    received_by_name: string | null
    total_tests: number
    entered_count: number
    approved_count: number
    pending_count: number
    coa_reports?: Array<{ status: CoAReportStatus; error_message?: string | null }> | null
}

interface ApprovalQueueTableProps {
    data: ApprovalQueueSample[]
    selectedSampleId?: string
}

export function ApprovalQueueTable({ data, selectedSampleId }: ApprovalQueueTableProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Client-side pagination state
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(20)

    const handleRowClick = (row: ApprovalQueueSample) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('sampleId', row.id)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const columns: ColumnDef<ApprovalQueueSample>[] = [
        {
            accessorKey: 'sample_id',
            header: GRID_LABELS.columns.sampleId,
            cell: ({ row }) => <SampleIdCell value={row.getValue('sample_id')} />,
        },
        {
            accessorKey: 'client_name',
            header: GRID_LABELS.columns.clientName,
            cell: ({ row }) => <ClientNameCell value={row.getValue('client_name')} />,
        },
        {
            accessorKey: 'status',
            header: GRID_LABELS.columns.status,
            cell: ({ row }) => <StatusCell status={row.getValue('status')} />,
        },
        {
            id: 'coa_status',
            header: GRID_LABELS.columns.coa,
            cell: ({ row }) => (
                <CoAStatusCell
                    status={row.original.coa_reports?.[0]?.status}
                    errorMessage={row.original.coa_reports?.[0]?.error_message}
                />
            ),
        },
        {
            id: 'progress',
            header: GRID_LABELS.columns.progress,
            cell: ({ row }) => (
                <ProgressCell
                    enteredCount={row.original.entered_count}
                    approvedCount={row.original.approved_count}
                    totalTests={row.original.total_tests}
                />
            ),
        },
        {
            accessorKey: 'received_at',
            header: GRID_LABELS.columns.receivedAt,
            cell: ({ row }) => <DateCell value={row.getValue('received_at')} />,
        },
        {
            accessorKey: 'updated_at',
            header: GRID_LABELS.columns.updatedAt,
            cell: ({ row }) => <DateCell value={row.getValue('updated_at')} />,
        },
        {
            id: 'actions',
            header: GRID_LABELS.columns.actions,
            cell: ({ row }) => {
                const isCompleted = row.original.status === 'completed'
                const coaStatus = row.original.coa_reports?.[0]?.status

                return (
                    <div className="flex items-center gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Xem chi tiết và phê duyệt"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleRowClick(row.original)
                                            e.currentTarget.blur()
                                        }}
                                        className="h-8 w-8 text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950"
                                    >
                                        <FileSearch className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Xem chi tiết và phê duyệt</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* CoA Generation Button - For completed samples without CoA, with failed CoA, or with pending CoA (stuck) */}
                        {isCompleted && (!coaStatus || coaStatus === 'failed' || coaStatus === 'pending') && (
                            <CoAActionButton
                                sampleId={row.original.id}
                                coaStatus={coaStatus}
                            />
                        )}
                    </div>
                )
            },
        },
    ]

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        state: {
            pagination: {
                pageIndex,
                pageSize,
            },
        },
        onPaginationChange: (updater) => {
            if (typeof updater === 'function') {
                const newState = updater({ pageIndex, pageSize })
                setPageIndex(newState.pageIndex)
                setPageSize(newState.pageSize)
            } else {
                setPageIndex(updater.pageIndex)
                setPageSize(updater.pageSize)
            }
        },
    })

    return (
        <SampleDataGrid
            table={table}
            pagination={{ mode: 'client', table }}
            selectedRowId={selectedSampleId}
            onRowClick={handleRowClick}
            emptyIcon={ClipboardPen}
            emptyMessage={GRID_LABELS.empty.noApprovals}
            animatedRows={false}
        />
    )
}
