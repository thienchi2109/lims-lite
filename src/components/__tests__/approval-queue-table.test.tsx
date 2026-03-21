import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

const mockReplace = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/manager/approvals',
}))

vi.mock('@/components/coa-action-button', () => ({
    CoAActionButton: () => null,
}))

vi.mock('@/components/sample-grid', async () => {
    const actual = await vi.importActual<typeof import('@/components/sample-grid')>('@/components/sample-grid')
    const { flexRender } = await import('@tanstack/react-table')

    return {
        ...actual,
        SampleDataGrid: ({ table, onRowClick }: any) => (
            <table data-testid="approval-grid">
                <tbody>
                    {table.getRowModel().rows.map((row: any) => (
                        <tr
                            key={row.id}
                            data-testid={`row-${row.original.id}`}
                            onClick={(event) => onRowClick?.(row.original, event)}
                        >
                            {row.getVisibleCells().map((cell: any) => (
                                <td key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        ),
    }
})

import { ApprovalQueueTable } from '../approval-queue-table'

beforeEach(() => {
    mockReplace.mockClear()
    mockRefresh.mockClear()
})

describe('ApprovalQueueTable', () => {
    const mockData = [
        {
            id: 'sample-1',
            sample_id: 'CDC-XN-0001',
            status: 'review' as const,
            client_name: 'Nguyễn A',
            received_at: '2026-01-05T10:00:00Z',
            received_by_name: 'KTV A',
            total_tests: 2,
            entered_count: 2,
            approved_count: 0,
            pending_count: 0,
            updated_at: '2026-01-05T11:00:00Z',
            coa_reports: null,
        },
    ]

    it('keeps the detail button accessible and removes focus after activation', async () => {
        const { container } = render(<ApprovalQueueTable data={mockData} selectedSampleId={null} />)

        const detailButton = container.querySelector('button') as HTMLButtonElement | null

        expect(detailButton).not.toBeNull()
        expect(detailButton?.getAttribute('aria-label')).toBe('Xem chi tiết và phê duyệt')

        act(() => {
            detailButton?.focus()
            fireEvent.click(detailButton as HTMLButtonElement)
        })
        expect(document.activeElement).not.toBe(detailButton)

        expect(mockReplace).toHaveBeenCalledWith(
            expect.stringContaining('sampleId=sample-1'),
            { scroll: false },
        )
    })

    it('still navigates when the sample row is clicked', async () => {
        const { container } = render(<ApprovalQueueTable data={mockData} selectedSampleId={null} />)

        fireEvent.click(container.querySelector('[data-testid="row-sample-1"]') as HTMLTableRowElement)

        expect(mockReplace).toHaveBeenCalledWith(
            expect.stringContaining('sampleId=sample-1'),
            { scroll: false },
        )
    })
})
