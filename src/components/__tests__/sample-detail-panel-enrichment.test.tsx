import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

let mockClientData: Record<string, unknown> | null = null

vi.mock('@/hooks/use-client', () => ({
    useClient: () => ({
        data: mockClientData,
        isLoading: false,
        error: null,
    }),
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
    SampleActivityFeed: () => <div data-testid="sample-activity-feed">Đang tải lịch sử...</div>,
}))

import { SampleDetailPanel } from '../sample-detail-panel'
import type { SampleWithUser } from '@/types'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
    client_id: 'client-1',
    client_name: 'Khach hang A',
    status: 'review',
    received_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    received_by_name: 'User A',
} as unknown as SampleWithUser

describe('SampleDetailPanel enrichment isolation', () => {
    beforeEach(() => {
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
    })

    it('keeps the sample detail visible when activity enrichment is loading', () => {
        render(<SampleDetailPanel sample={sample} />)

        fireEvent.click(screen.getByRole('button', { name: /Lịch sử cập nhật/i }))

        expect(screen.getByText('CDC-XN-0001')).toBeDefined()
        expect(screen.getByText('Thông tin bệnh nhân')).toBeDefined()
        expect(screen.getByTestId('sample-activity-feed')).toBeDefined()
    })
})
