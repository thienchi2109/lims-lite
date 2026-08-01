import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssayDefinitionWithMethods } from '@/types'

const mockFetchAssayDefinitionsClient = vi.fn()
const mockFetchMethodsClient = vi.fn()

vi.mock('@/lib/api-client', () => ({
    fetchAssayDefinitionsClient: (...args: unknown[]) => mockFetchAssayDefinitionsClient(...args),
    fetchMethodsClient: (...args: unknown[]) => mockFetchMethodsClient(...args),
}))

import { useTestAssignmentGrid } from '../use-test-assignment-grid'

function makeAssay(id: string, name: string): AssayDefinitionWithMethods {
    return {
        id,
        name,
        specialty_id: null,
        units: null,
        method_name: null,
        methods: [],
        validation_rules: {},
        is_confidential: false,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        deleted_at: null,
    }
}

function createDeferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise
    })
    return { promise, resolve }
}

function renderAssignmentGrid() {
    return renderHook(() =>
        useTestAssignmentGrid({
            selected: [],
            onChange: vi.fn(),
            disabledAssayIds: [],
            specialties: [],
        }),
    )
}

async function advanceTimers(milliseconds: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds)
    })
}

describe('useTestAssignmentGrid assay fetch lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        mockFetchMethodsClient.mockResolvedValue({ data: [] })
        mockFetchAssayDefinitionsClient.mockResolvedValue({ data: [] })
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('issues exactly one assay request on initial mount', async () => {
        renderAssignmentGrid()

        expect(mockFetchAssayDefinitionsClient).toHaveBeenCalledTimes(1)

        await advanceTimers(300)

        expect(mockFetchAssayDefinitionsClient).toHaveBeenCalledTimes(1)
    })

    it('debounces search requests for 300ms', async () => {
        const { result } = renderAssignmentGrid()
        await advanceTimers(300)
        mockFetchAssayDefinitionsClient.mockClear()

        act(() => {
            result.current.setSearchQuery('HBV')
        })

        await advanceTimers(299)
        expect(mockFetchAssayDefinitionsClient).not.toHaveBeenCalled()

        await advanceTimers(1)
        expect(mockFetchAssayDefinitionsClient).toHaveBeenCalledTimes(1)
        expect(mockFetchAssayDefinitionsClient).toHaveBeenCalledWith(
            {
                pageSize: 2000,
                methodId: 'all',
                specialtyId: 'all',
                search: 'HBV',
            },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        )
    })

    it('applies filter changes immediately with the latest debounced search and current filters', async () => {
        const { result } = renderAssignmentGrid()
        await advanceTimers(300)

        act(() => {
            result.current.setSearchQuery('stable search')
        })
        await advanceTimers(300)
        mockFetchAssayDefinitionsClient.mockClear()

        await act(async () => {
            result.current.setSearchQuery('pending search')
            result.current.setSelectedMethodId('method-1')
            await Promise.resolve()
        })

        expect(mockFetchAssayDefinitionsClient).toHaveBeenCalledTimes(1)
        expect(mockFetchAssayDefinitionsClient).toHaveBeenLastCalledWith(
            {
                pageSize: 2000,
                methodId: 'method-1',
                specialtyId: 'all',
                search: 'stable search',
            },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        )

        mockFetchAssayDefinitionsClient.mockClear()
        await act(async () => {
            result.current.setSelectedSpecialtyId('specialty-1')
            await Promise.resolve()
        })

        expect(mockFetchAssayDefinitionsClient).toHaveBeenCalledTimes(1)
        expect(mockFetchAssayDefinitionsClient).toHaveBeenLastCalledWith(
            {
                pageSize: 2000,
                methodId: 'method-1',
                specialtyId: 'specialty-1',
                search: 'stable search',
            },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        )
    })

    it('aborts the previous assay request whenever fetch criteria change', async () => {
        const { result } = renderAssignmentGrid()
        await advanceTimers(300)
        mockFetchAssayDefinitionsClient.mockClear()
        mockFetchAssayDefinitionsClient.mockImplementation(() => new Promise(() => {}))

        act(() => {
            result.current.setSearchQuery('HIV')
        })
        await advanceTimers(300)

        const firstSignal = mockFetchAssayDefinitionsClient.mock.calls[0][1]?.signal as AbortSignal
        expect(firstSignal.aborted).toBe(false)

        act(() => {
            result.current.setSelectedMethodId('method-1')
        })

        expect(firstSignal.aborted).toBe(true)
        const secondSignal = mockFetchAssayDefinitionsClient.mock.calls[1][1]?.signal as AbortSignal
        expect(secondSignal.aborted).toBe(false)

        act(() => {
            result.current.setSelectedSpecialtyId('specialty-1')
        })

        expect(secondSignal.aborted).toBe(true)
        const thirdSignal = mockFetchAssayDefinitionsClient.mock.calls[2][1]?.signal as AbortSignal
        expect(thirdSignal.aborted).toBe(false)

        act(() => {
            result.current.setSearchQuery('HBV')
        })
        await advanceTimers(299)
        expect(thirdSignal.aborted).toBe(false)

        await advanceTimers(1)
        expect(thirdSignal.aborted).toBe(true)
        const fourthSignal = mockFetchAssayDefinitionsClient.mock.calls[3][1]?.signal as AbortSignal
        expect(fourthSignal.aborted).toBe(false)
    })

    it('ignores stale responses without overwriting assays or current loading state', async () => {
        const initialAssay = makeAssay('assay-initial', 'Initial assay')
        const staleAssay = makeAssay('assay-stale', 'Stale assay')
        const currentAssay = makeAssay('assay-current', 'Current assay')
        const staleRequest = createDeferred<{ data: AssayDefinitionWithMethods[] }>()
        const currentRequest = createDeferred<{ data: AssayDefinitionWithMethods[] }>()
        mockFetchAssayDefinitionsClient.mockResolvedValue({ data: [initialAssay] })

        const { result } = renderAssignmentGrid()
        await advanceTimers(300)
        expect(result.current.processedAssays).toEqual([initialAssay])
        mockFetchAssayDefinitionsClient.mockClear()
        mockFetchAssayDefinitionsClient
            .mockImplementationOnce(() => staleRequest.promise)
            .mockImplementationOnce(() => currentRequest.promise)

        act(() => {
            result.current.setSearchQuery('HIV')
        })
        await advanceTimers(300)
        act(() => {
            result.current.setSelectedMethodId('method-1')
        })

        await act(async () => {
            staleRequest.resolve({ data: [staleAssay] })
            await staleRequest.promise
        })

        expect(result.current.processedAssays).toEqual([initialAssay])
        expect(result.current.isLoading).toBe(true)

        await act(async () => {
            currentRequest.resolve({ data: [currentAssay] })
            await currentRequest.promise
        })

        expect(result.current.processedAssays).toEqual([currentAssay])
        expect(result.current.isLoading).toBe(false)
    })
})
