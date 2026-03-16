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

describe('SampleDetailPanel mobile behavior', () => {
    it('hides lifecycle progress chevron on mobile breakpoints', () => {
        render(<SampleDetailPanel sample={sample} />)

        const lifecycleChevron = screen.getByTestId('sample-lifecycle-chevron')
        expect(lifecycleChevron.className).toContain('hidden')
        expect(lifecycleChevron.className).toContain('sm:flex')
    })
})
