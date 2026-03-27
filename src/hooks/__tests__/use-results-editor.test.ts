import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSaveBatchResultsClient = vi.fn()
const mockInvalidateSampleQueries = vi.fn()
const mockQueryClient = { invalidateQueries: vi.fn() }

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => mockQueryClient,
}))

vi.mock('@/lib/api-client', () => ({
    saveBatchResultsClient: (...args: unknown[]) => mockSaveBatchResultsClient(...args),
}))

vi.mock('@/types/query-keys', () => ({
    invalidateSampleQueries: (...args: unknown[]) => mockInvalidateSampleQueries(...args),
}))

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
    },
}))

import { useResultsEditor } from '../use-results-editor'

describe('useResultsEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSaveBatchResultsClient.mockResolvedValue({ success: true })
        mockInvalidateSampleQueries.mockResolvedValue(undefined)
    })

    it('invalidates the shared sample caches after a successful save', async () => {
        const onSaveSuccess = vi.fn()

        const { result } = renderHook(() =>
            useResultsEditor({
                results: [
                    {
                        id: 'result-1',
                        validation_rules: {},
                        value: null,
                    } as any,
                ],
                sampleId: 'sample-1',
                onSaveSuccess,
            }),
        )

        await act(async () => {
            await result.current.handleValueChange('result-1', '5.2')
        })

        await act(async () => {
            await result.current.handleSave()
        })

        expect(mockSaveBatchResultsClient).toHaveBeenCalledWith({
            results: [{ id: 'result-1', value: '5.2' }],
        })
        expect(mockInvalidateSampleQueries).toHaveBeenCalledWith(
            mockQueryClient,
            'sample-1',
        )
        expect(onSaveSuccess).toHaveBeenCalled()
    })
})
