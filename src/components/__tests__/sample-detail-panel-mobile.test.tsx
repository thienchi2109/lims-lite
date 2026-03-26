import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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
    it('uses a visibly compact chrome and a constrained internal scroll region', () => {
        const { container } = render(<SampleDetailPanel sample={sample} />)

        const panel = container.querySelector('#tour-sample-detail')
        const header = panel?.firstElementChild as HTMLDivElement | null
        const tabs = header?.nextElementSibling as HTMLDivElement | null
        const content = tabs?.nextElementSibling as HTMLDivElement | null
        const detailBody = content?.firstElementChild as HTMLDivElement | null
        const detailTab = screen.getByRole('button', { name: /Thông tin/i })

        expect(panel?.className).toContain('min-h-0')
        expect(header?.className).toContain('px-2.5')
        expect(header?.className).toContain('py-1')
        expect(detailTab.className).toContain('px-2.5')
        expect(detailTab.className).toContain('py-1')
        expect(detailTab.className).toContain('text-[11px]')
        expect(content?.className).toContain('min-h-0')
        expect(content?.className).toContain('overflow-y-auto')
        expect(detailBody?.className).toContain('p-3')
        expect(detailBody?.className).toContain('text-sm')
    })

    it('uses compact typography inside the client detail grid when client data is present', () => {
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

        render(<SampleDetailPanel sample={{ ...sample, client_id: 'client-1' }} />)

        const infoRow = screen.getByText('Số CCCD').parentElement
        const detailValue = screen.getByText('079123456789')

        expect(infoRow?.className).toContain('flex')
        expect(infoRow?.className).toContain('items-baseline')
        expect(screen.getByText('Số CCCD').className).toContain('text-xs')
        expect(detailValue.className).toContain('text-sm')

        mockClientData = null
    })

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
