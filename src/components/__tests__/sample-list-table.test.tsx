import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockReplace = vi.fn()
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: mockPush }),
    useSearchParams: () => new URLSearchParams(),
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
        SampleDataGrid: ({ table }: any) => (
            <div data-testid="sample-data-grid">
                {table.getRowModel().rows.map((row: any) => (
                    <div key={row.id} data-testid={`row-${row.id}`}>
                        {row.getVisibleCells().map((cell: any) => (
                            <div key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        ),
        SampleIdCell: ({ value }: any) => <span>{value}</span>,
        ClientNameCell: ({ value }: any) => <span>{value}</span>,
        StatusCell: ({ status }: any) => <span>{status}</span>,
        DateCell: ({ value }: any) => <span>{value}</span>,
        ReceiverCell: ({ receiverName }: any) => <span>{receiverName}</span>,
        ColumnHeader: ({ label }: any) => <span>{label}</span>,
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
