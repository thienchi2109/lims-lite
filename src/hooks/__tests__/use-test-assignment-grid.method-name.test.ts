import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetchAssayDefinitionsClient = vi.fn()
const mockFetchMethodsClient = vi.fn()

vi.mock('@/lib/api-client', () => ({
    fetchAssayDefinitionsClient: (...args: unknown[]) => mockFetchAssayDefinitionsClient(...args),
    fetchMethodsClient: (...args: unknown[]) => mockFetchMethodsClient(...args),
}))

import { useTestAssignmentGrid } from '../use-test-assignment-grid'
import type { AssayDefinitionWithMethods } from '@/types'

describe('useTestAssignmentGrid method text assignment', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchMethodsClient.mockResolvedValue({ data: [] })
    })

    it('selects an assay-owned method name without requiring a method_id', async () => {
        const assay = {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'HBV DNA',
            specialty_id: null,
            units: 'IU/mL',
            method_name: 'RT-PCR tự thiết lập',
            methods: [],
            validation_rules: {},
            is_confidential: false,
            created_at: '2026-07-08T00:00:00.000Z',
            updated_at: '2026-07-08T00:00:00.000Z',
            deleted_at: null,
        } satisfies AssayDefinitionWithMethods
        const onChange = vi.fn()
        mockFetchAssayDefinitionsClient.mockResolvedValue({ data: [assay] })

        const { result } = renderHook(() =>
            useTestAssignmentGrid({
                selected: [],
                onChange,
                disabledAssayIds: [],
                specialties: [],
            }),
        )

        await waitFor(() => {
            expect(result.current.processedAssays).toHaveLength(1)
        })

        act(() => {
            result.current.toggleTestSelection(assay)
        })

        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({
                assayId: '11111111-1111-4111-8111-111111111111',
                methodId: null,
                methodName: 'RT-PCR tự thiết lập',
            }),
        ])
    })
})
