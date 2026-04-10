import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mockReplace = vi.fn()
const mockPush = vi.fn()

interface MockTableCell {
    id: string
    column: {
        columnDef: {
            cell: unknown
        }
    }
    getContext: () => unknown
}

interface MockTableRow {
    id: string
    getVisibleCells: () => MockTableCell[]
}

interface MockTable {
    getRowModel: () => {
        rows: MockTableRow[]
    }
}

interface ValueCellProps {
    value: string | null | undefined
}

interface StatusCellProps {
    status: string
}

interface ReceiverCellProps {
    receiverName: string | null | undefined
}

interface HeaderCellProps {
    label: string
}

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: mockPush }),
    usePathname: () => '/manager/samples',
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('@/components/sample-edit-dialog', () => ({
    SampleEditDialog: () => null,
}))

vi.mock('@/components/discard-sample-dialog', () => ({
    DiscardSampleDialog: () => null,
}))

vi.mock('@/components/sample-grid', async () => {
    const { flexRender } = await import('@tanstack/react-table')

    return {
        SampleDataGrid: ({
            table,
            pagination,
            isTransitioning,
        }: {
            table: MockTable
            pagination?: {
                mode: 'server'
                page: number
                totalPages: number
                onPageChange: (page: number) => void
                isPending?: boolean
            }
            isTransitioning?: boolean
        }) => (
            <div data-testid="sample-data-grid">
                {table.getRowModel().rows.map((row: MockTableRow) => (
                    <div key={row.id} data-testid={`row-${row.id}`}>
                        {row.getVisibleCells().map((cell: MockTableCell) => (
                            <div key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                        ))}
                    </div>
                ))}
                {pagination?.mode === 'server' && (
                    <div>
                        <div data-testid="pagination-pending">{String(Boolean(pagination.isPending))}</div>
                        <button
                            type="button"
                            data-testid="pagination-prev"
                            disabled={Boolean(pagination.isPending) || pagination.page <= 1}
                            onClick={() => pagination.onPageChange(pagination.page - 1)}
                        >
                            prev
                        </button>
                        <button
                            type="button"
                            data-testid="pagination-next"
                            disabled={Boolean(pagination.isPending) || pagination.page >= pagination.totalPages}
                            onClick={() => pagination.onPageChange(pagination.page + 1)}
                        >
                            next
                        </button>
                    </div>
                )}
                <div data-testid="grid-transitioning">{String(Boolean(isTransitioning))}</div>
            </div>
        ),
        SampleIdCell: ({ value }: ValueCellProps) => <span>{value}</span>,
        ClientNameCell: ({ value }: ValueCellProps) => <span>{value}</span>,
        StatusCell: ({ status }: StatusCellProps) => <span>{status}</span>,
        DateCell: ({ value }: ValueCellProps) => <span>{value}</span>,
        ReceiverCell: ({ receiverName }: ReceiverCellProps) => <span>{receiverName}</span>,
        ColumnHeader: ({ label }: HeaderCellProps) => <span>{label}</span>,
        useGridHighlight: () => [],
        GRID_LABELS: {
            columns: {
                sampleId: 'Mã mẫu',
                clientName: 'Khách hàng',
                status: 'Trạng thái',
                receivedAt: 'Ngày nhận',
                receiver: 'Người nhận',
                updatedAt: 'Cập nhật',
                actions: 'Thao tác',
            },
        },
    }
})

import { SampleListTable } from '../sample-list-table'
import type { SampleWithUser } from '@/types'

function buildSample(status: SampleWithUser['status']): SampleWithUser {
    return {
        id: `sample-${status}`,
        sample_id: 'CDC-XN-TEST-0002',
        status,
        client_name: 'Khách hàng B',
        received_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        received_by_name: 'User B',
    } as unknown as SampleWithUser
}

describe('SampleListTable discard action visibility', () => {
    beforeEach(() => {
        mockReplace.mockClear()
        mockPush.mockClear()
    })

    it('shows discard action for in_progress samples in manager workspace', () => {
        render(
            <SampleListTable
                samples={[buildSample('in_progress')]}
                page={1}
                pageSize={10}
                totalPages={1}
                totalCount={1}
                searchParams=""
                permissions={{
                    canDiscard: true,
                    canEdit: false,
                    canViewResults: true,
                    canEnterResults: false,
                }}
            />,
        )

        expect(screen.getByTitle('Loại bỏ mẫu')).toBeDefined()
    })

    it('keeps discard action hidden for review samples in manager workspace', () => {
        render(
            <SampleListTable
                samples={[buildSample('review')]}
                page={1}
                pageSize={10}
                totalPages={1}
                totalCount={1}
                searchParams=""
                permissions={{
                    canDiscard: true,
                    canEdit: false,
                    canViewResults: true,
                    canEnterResults: false,
                }}
            />,
        )

        expect(screen.queryByTitle('Loại bỏ mẫu')).toBeNull()
    })

    it('keeps the actions cell marked to suppress row clicks even when no actions render', () => {
        const { container } = render(
            <SampleListTable
                samples={[buildSample('completed')]}
                page={1}
                pageSize={10}
                totalPages={1}
                totalCount={1}
                searchParams=""
                permissions={{
                    canDiscard: false,
                    canEdit: false,
                    canViewResults: false,
                    canEnterResults: false,
                }}
            />,
        )

        expect(container.querySelector('[data-stop-row-click="true"]')).not.toBeNull()
    })

    it('shows a pending pagination state immediately after requesting the next server page', () => {
        render(
            <SampleListTable
                samples={[buildSample('completed')]}
                page={1}
                pageSize={10}
                totalPages={3}
                totalCount={25}
                searchParams="page=1"
                permissions={{
                    canDiscard: false,
                    canEdit: false,
                    canViewResults: false,
                    canEnterResults: false,
                }}
            />,
        )

        fireEvent.click(screen.getByTestId('pagination-next'))

        expect(mockReplace).toHaveBeenCalledWith('/manager/samples?page=2', { scroll: false })
        expect(screen.getByTestId('pagination-pending').textContent).toBe('true')
        expect(screen.getByTestId('pagination-next').hasAttribute('disabled')).toBe(true)
        expect(screen.getByTestId('pagination-prev').hasAttribute('disabled')).toBe(true)
        expect(screen.getByTestId('grid-transitioning').textContent).toBe('true')
    })
})
