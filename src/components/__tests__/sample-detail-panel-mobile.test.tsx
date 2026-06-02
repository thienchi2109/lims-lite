import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockClientData: Record<string, unknown> | null = null
const mockUseClient = vi.fn(() => ({
    data: mockClientData,
    isLoading: false,
    error: null,
}))

vi.mock('@/hooks/use-client', () => ({
    useClient: (args: unknown) => mockUseClient(args),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('@/components/sample-edit-dialog', () => ({
    SampleEditDialog: () => null,
}))

vi.mock('@/components/sample-activity-feed', () => ({
    SampleActivityFeed: () => null,
}))

import { SampleDetailPanel } from '../sample-detail-panel'
import type { SampleWithUser } from '@/types'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-TEST-0001',
    status: 'review',
    client_id: null,
    client_name: 'Khach hang A',
    received_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    received_by_name: 'User A',
} as unknown as SampleWithUser

function buildSampleWithStatus(status: SampleWithUser['status']): SampleWithUser {
    return {
        ...sample,
        status,
        rejection_reason: 'Thiếu dữ liệu QC',
        rejected_at: '2026-01-02T08:00:00.000Z',
        rejected_by_name: 'Manager A',
    } as unknown as SampleWithUser
}

describe('SampleDetailPanel redesigned layout', () => {
    beforeEach(() => {
        mockClientData = null
        mockUseClient.mockClear()
    })

    it('renders header with sample ID label, tabs, and scrollable content area', () => {
        const { container } = render(<SampleDetailPanel sample={sample} />)

        const panel = container.querySelector('#tour-sample-detail')
        const content = panel?.querySelector('.overflow-y-auto')

        // Panel uses flex column with min-h-0 for scroll containment
        expect(panel?.className).toContain('min-h-0')
        expect(panel?.className).toContain('flex-col')
        // Content area is scrollable
        expect(content?.className).toContain('min-h-0')
        expect(content?.className).toContain('overflow-y-auto')
        // Sample ID label exists
        expect(screen.getByText('Mã mẫu xét nghiệm')).toBeDefined()
        // Sample ID is visible
        expect(screen.getByText('CDC-XN-TEST-0001')).toBeDefined()
        // Tabs exist as buttons
        expect(screen.getByRole('button', { name: /Thông tin/i })).toBeDefined()
        expect(screen.getByRole('button', { name: /Lịch sử cập nhật/i })).toBeDefined()
    })

    it('displays patient info in a 2-column grid layout when client data is present', () => {
        mockClientData = {
            name: 'Khach hang A',
            id_card_num: '079123456789',
            date_of_birth: '1990-01-01',
            gender: 'Nam',
            phone: '0901234567',
            address: '123 Duong ABC',
            health_insurance_num: 'BHYT-123',
            expiry_date: '2026-12-31',
        }

        const { container } = render(<SampleDetailPanel sample={{ ...sample, client_id: 'client-1' }} />)

        // 2-column grid exists
        const grid = container.querySelector('.grid.grid-cols-2')
        expect(grid).toBeDefined()
        expect(grid).not.toBeNull()

        // InfoCell uses stacked layout (label above, value below)
        const labelEl = screen.getByText('Số CCCD')
        const cellContainer = labelEl.parentElement
        expect(cellContainer?.className).toContain('flex-col')
        // Value is displayed
        expect(screen.getByText('079123456789')).toBeDefined()

        mockClientData = null
    })

    it('uses embedded client details as placeholder data while still requesting a fresh client query', () => {
        render(
            <SampleDetailPanel
                sample={{
                    ...sample,
                    client_id: 'client-1',
                    client: {
                        id: 'client-1',
                        name: 'Khach hang A',
                        id_card_num: '079123456789',
                        date_of_birth: '1990-01-01',
                        gender: 'Nam',
                        phone: '0901234567',
                        address: '123 Duong ABC',
                        health_insurance_num: 'BHYT-123',
                        expiry_date: '2026-12-31',
                        created_at: '2026-01-01T00:00:00.000Z',
                        updated_at: '2026-01-01T00:00:00.000Z',
                    },
                } as SampleWithUser}
            />,
        )

        expect(mockUseClient).toHaveBeenCalledWith({
            clientId: 'client-1',
            initialData: expect.objectContaining({
                name: 'Khach hang A',
                id_card_num: '079123456789',
            }),
        })
        expect(screen.getByText('079123456789')).toBeDefined()
    })

    it('renders progress stepper with correct status visualization', () => {
        render(<SampleDetailPanel sample={sample} />)

        // Status bar stepper steps are visible
        expect(screen.getByText('Đã nhận')).toBeDefined()
        expect(screen.getByText('Đã chỉ định')).toBeDefined()
        expect(screen.getByText('Đang thực hiện')).toBeDefined()
        expect(screen.getByText('Hoàn thành')).toBeDefined()
    })

    it('renders metadata footer in a card', () => {
        render(<SampleDetailPanel sample={sample} />)

        // Footer labels
        expect(screen.getByText('Thời điểm nhận')).toBeDefined()
        expect(screen.getByText('Người nhận mẫu')).toBeDefined()
        expect(screen.getByText('Cập nhật cuối')).toBeDefined()
        // Values
        expect(screen.getByText('User A')).toBeDefined()
    })

    it('shows rejection banner for in_progress samples with rejection metadata', () => {
        render(<SampleDetailPanel sample={buildSampleWithStatus('in_progress')} />)
        expect(screen.getByText('Mẫu đã bị từ chối')).toBeDefined()
    })

    it('shows discard banner for discarded samples with rejection metadata', () => {
        render(<SampleDetailPanel sample={buildSampleWithStatus('discarded')} />)
        expect(screen.getByText('Mẫu đã bị loại bỏ')).toBeDefined()
    })

    it('hides rejection banner for review samples even when rejection metadata exists', () => {
        render(<SampleDetailPanel sample={buildSampleWithStatus('review')} />)
        expect(screen.queryByText('Mẫu đã bị từ chối')).toBeNull()
        expect(screen.queryByText('Mẫu đã bị loại bỏ')).toBeNull()
    })

    it('hides rejection banner for completed samples even when rejection metadata exists', () => {
        render(<SampleDetailPanel sample={buildSampleWithStatus('completed')} />)
        expect(screen.queryByText('Mẫu đã bị từ chối')).toBeNull()
        expect(screen.queryByText('Mẫu đã bị loại bỏ')).toBeNull()
    })
})
