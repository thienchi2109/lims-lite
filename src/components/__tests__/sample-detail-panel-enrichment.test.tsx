import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseClient = vi.fn()

vi.mock('@/hooks/use-client', () => ({
    useClient: (...args: unknown[]) => mockUseClient(...args),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('@/components/sample-edit-dialog', () => ({
    SampleEditDialog: () => null,
}))

import { SampleDetailPanel } from '../sample-detail-panel'
import type { SampleWithUser } from '@/types'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
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
    status: 'review',
    received_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    received_by_name: 'User A',
} as unknown as SampleWithUser

describe('SampleDetailPanel enrichment isolation', () => {
    beforeEach(() => {
        mockUseClient.mockReturnValue({
            data: sample.client,
            isLoading: false,
            error: new Error('Không thể tải thông tin khách hàng'),
        })
    })

    it('keeps snapshot client detail visible while client enrichment fails', () => {
        render(<SampleDetailPanel sample={sample} />)

        expect(mockUseClient).toHaveBeenCalledWith({
            clientId: 'client-1',
            placeholderData: sample.client,
        })

        expect(screen.getByText('CDC-XN-0001')).toBeDefined()
        expect(screen.getByText('Thông tin bệnh nhân')).toBeDefined()
        expect(screen.getByText('Khach hang A')).toBeDefined()
        expect(screen.getByText('079123456789')).toBeDefined()
        expect(screen.getByText('Thời điểm nhận')).toBeDefined()
        expect(screen.getByText('Không thể tải thông tin khách hàng')).toBeDefined()
    })
})
