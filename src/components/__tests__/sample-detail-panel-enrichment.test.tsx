import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/use-client', () => ({
    useClient: () => ({
        data: null,
        isLoading: false,
        error: new Error('Không thể tải thông tin khách hàng'),
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
    it('keeps snapshot client detail visible while client enrichment fails', () => {
        render(<SampleDetailPanel sample={sample} />)

        expect(screen.getByText('CDC-XN-0001')).toBeDefined()
        expect(screen.getByText('Thông tin bệnh nhân')).toBeDefined()
        expect(screen.getByText('Khach hang A')).toBeDefined()
        expect(screen.getByText('Thời điểm nhận')).toBeDefined()
        expect(screen.getByText('Không thể tải thông tin khách hàng')).toBeDefined()
    })
})
