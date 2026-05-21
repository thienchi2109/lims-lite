import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseClient = vi.fn()
const mockInvalidateQueries = vi.fn()
const mockMarkLocalSamplesMutation = vi.fn()
const mockPrintSampleBarcodeLabel = vi.fn()

vi.mock('@/hooks/use-client', () => ({
    useClient: (...args: unknown[]) => mockUseClient(...args),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}))

vi.mock('@/lib/samples-realtime', () => ({
    markLocalSamplesMutation: (...args: unknown[]) => mockMarkLocalSamplesMutation(...args),
}))

vi.mock('@/lib/sample-label-print-client', () => ({
    printSampleBarcodeLabel: (...args: unknown[]) => mockPrintSampleBarcodeLabel(...args),
}))

vi.mock('@/components/sample-edit-dialog', () => ({
    SampleEditDialog: ({
        onSuccess,
    }: {
        onSuccess?: () => void
    }) => <button onClick={onSuccess}>Mock edit success</button>,
}))

vi.mock('@/components/sample-activity-feed', () => ({
    SampleActivityFeed: () => null,
}))

import { SampleDetailPanel } from '../sample-detail-panel'
import { sampleKeys, clientKeys } from '@/types/query-keys'
import type { SampleWithUser } from '@/types'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-TEST-0001',
    status: 'assigned',
    client_id: 'client-1',
    client_name: 'Khach hang A',
    received_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    received_by_name: 'User A',
} as unknown as SampleWithUser

describe('SampleDetailPanel invalidation contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseClient.mockReturnValue({
            data: null,
            isLoading: false,
            error: null,
        })
    })

    it('invalidates the selected-sample cache after a successful sample edit', () => {
        render(<SampleDetailPanel sample={sample} />)

        fireEvent.click(screen.getByRole('button', { name: 'Mock edit success' }))

        expect(mockMarkLocalSamplesMutation).toHaveBeenCalledWith('sample-1')
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: sampleKeys.all,
        })
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: sampleKeys.selectionCore('sample-1'),
        })
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: clientKeys.detail('client-1'),
        })
    })

    it('prints a barcode label from the selected sample detail header', () => {
        render(<SampleDetailPanel sample={sample} />)

        fireEvent.click(screen.getByRole('button', { name: 'In nhãn barcode' }))

        expect(mockPrintSampleBarcodeLabel).toHaveBeenCalledWith('sample-1', {
            preset: 'small-tube',
        })
    })
})
