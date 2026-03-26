import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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
        SampleDataGrid: ({ table }: { table: MockTable }) => (
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
})
