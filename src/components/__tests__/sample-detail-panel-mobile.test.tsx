import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/use-client', () => ({
    useClient: () => ({
        data: null,
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
    SampleActivityFeed: () => null,
}))

vi.mock('@/components/sample-lifecycle-stepper', () => ({
    SampleLifecycleChevron: ({ className }: { className?: string }) => (
        <div data-testid="sample-lifecycle-chevron" className={className}>
            lifecycle
        </div>
    ),
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

describe('SampleDetailPanel mobile behavior', () => {
    it('hides lifecycle progress chevron on mobile breakpoints', () => {
        render(<SampleDetailPanel sample={sample} />)

        const lifecycleChevron = screen.getByTestId('sample-lifecycle-chevron')
        expect(lifecycleChevron.className).toContain('hidden')
        expect(lifecycleChevron.className).toContain('sm:flex')
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
