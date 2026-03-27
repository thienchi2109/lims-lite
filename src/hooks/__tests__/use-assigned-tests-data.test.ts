/**
 * Tests for useAssignedTestsData hook.
 *
 * Verifies data fetching, race-condition guard, CoA status,
 * and QC status fetching extracted from AssignedTestsPanel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAssignedTestsData } from '../use-assigned-tests-data'

// Mock dependencies
vi.mock('@/lib/api-client', () => ({
    fetchSampleResultsClient: vi.fn(),
}))

vi.mock('@/app/actions/coa', () => ({
    getCoAStatus: vi.fn(),
}))

vi.mock('@/app/actions/qc-status', () => ({
    getQCStatusForAssays: vi.fn(),
}))

import { fetchSampleResultsClient } from '@/lib/api-client'
import { getCoAStatus } from '@/app/actions/coa'
import { getQCStatusForAssays } from '@/app/actions/qc-status'

const mockFetch = vi.mocked(fetchSampleResultsClient)
const mockCoAStatus = vi.mocked(getCoAStatus)
const mockQCStatus = vi.mocked(getQCStatusForAssays)
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

describe('useAssignedTestsData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mockFetch.mockResolvedValue({ data: [], error: null })
        mockCoAStatus.mockResolvedValue({ status: null })
        mockQCStatus.mockResolvedValue({})
    })

    afterEach(() => {
        consoleErrorSpy.mockRestore()
    })

    it('returns loading=true initially', () => {
        mockFetch.mockReturnValueOnce(new Promise(() => {}) as any)
        const { result } = renderHook(() => useAssignedTestsData('sample-1'))
        expect(result.current.loading).toBe(true)
    })

    it('fetches results on mount with the given sampleId', async () => {
        mockFetch.mockResolvedValue({
            data: [{ id: 'r1', assay_id: 'a1', assay_name: 'Test', sample_status: 'assigned' }],
            error: null,
        })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(mockFetch).toHaveBeenCalledWith('sample-1')
        expect(result.current.results).toHaveLength(1)
        expect(result.current.error).toBeNull()
    })

    it('reuses initial core results without issuing a duplicate results fetch on mount', async () => {
        const initialResults = [
            {
                id: 'r1',
                assay_id: 'a1',
                assay_name: 'Creatinine',
                sample_status: 'completed',
            },
        ] as any

        const { result } = renderHook(() =>
            useAssignedTestsData('sample-1', {
                initialResults,
            }),
        )

        expect(mockFetch).not.toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
        expect(result.current.results).toEqual(initialResults)
        expect(result.current.sampleStatus).toBe('completed')

        await waitFor(() => expect(mockCoAStatus).toHaveBeenCalledWith('sample-1'))
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('reports enrichment loading while seeded QC enrichment is still in flight', async () => {
        const initialResults = [
            {
                id: 'r1',
                assay_id: 'a1',
                assay_name: 'Creatinine',
                sample_status: 'assigned',
            },
        ] as any

        mockQCStatus.mockReturnValue(new Promise(() => {}) as any)

        const { result } = renderHook(() =>
            useAssignedTestsData('sample-1', {
                initialResults,
            }),
        )

        await waitFor(() => expect(mockQCStatus).toHaveBeenCalledWith(['a1']))
        expect(result.current.enrichmentLoading).toBe(true)
    })

    it('sets sampleStatus from the first result', async () => {
        mockFetch.mockResolvedValue({
            data: [{ id: 'r1', assay_id: 'a1', sample_status: 'in_progress' }],
            error: null,
        })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.sampleStatus).toBe('in_progress')
    })

    it('sets error when fetch fails', async () => {
        mockFetch.mockResolvedValue({ data: null, error: 'Network error' })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe('Network error')
    })

    it('discards stale response when sampleId changes', async () => {
        // First fetch is slow
        let resolveFirst!: (value: { data: Array<{ id: string; assay_id: string; sample_status: string }>; error: null }) => void
        const slowPromise = new Promise<{ data: Array<{ id: string; assay_id: string; sample_status: string }>; error: null }>((resolve) => {
            resolveFirst = resolve
        })
        mockFetch.mockReturnValueOnce(slowPromise as any)

        // Second fetch is fast
        mockFetch.mockResolvedValueOnce({
            data: [{ id: 'r-B', assay_id: 'a2', sample_status: 'assigned' }],
            error: null,
        })

        const { result, rerender } = renderHook(
            ({ id }) => useAssignedTestsData(id),
            { initialProps: { id: 'sample-A' } },
        )

        // Switch to sample-B before sample-A resolves
        rerender({ id: 'sample-B' })

        await waitFor(() => expect(result.current.loading).toBe(false))

        // Resolve stale sample-A response
        await act(async () => {
            resolveFirst({
                data: [{ id: 'r-A', assay_id: 'a1', sample_status: 'completed' }],
                error: null,
            })
            await slowPromise
        })

        // Should show sample-B data, not stale sample-A
        expect(result.current.results[0]?.id).toBe('r-B')
    })

    it('clears coaStatus when switching to a different sample', async () => {
        let resolveSecondFetch!: (value: { data: Array<{ id: string; assay_id: string; sample_status: string }>; error: null }) => void
        const secondFetch = new Promise<{ data: Array<{ id: string; assay_id: string; sample_status: string }>; error: null }>((resolve) => {
            resolveSecondFetch = resolve
        })

        mockFetch
            .mockResolvedValueOnce({
                data: [{ id: 'r-A', assay_id: 'a1', sample_status: 'completed' }],
                error: null,
            })
            .mockReturnValueOnce(secondFetch as any)
        mockCoAStatus.mockResolvedValueOnce({ status: 'ready' })

        const { result, rerender } = renderHook(
            ({ id }) => useAssignedTestsData(id),
            { initialProps: { id: 'sample-A' } },
        )

        await waitFor(() => expect(result.current.coaStatus).toBe('ready'))

        rerender({ id: 'sample-B' })

        await waitFor(() => expect(result.current.coaStatus).toBeNull())

        await act(async () => {
            resolveSecondFetch({
                data: [{ id: 'r-B', assay_id: 'a2', sample_status: 'assigned' }],
                error: null,
            })
            await secondFetch
        })

        await waitFor(() => expect(result.current.loading).toBe(false))
    })

    it('preserves coaStatus when the same sample receives refreshed seeded results', async () => {
        const initialResults = [
            {
                id: 'r-A',
                assay_id: 'a1',
                assay_name: 'Creatinine',
                sample_status: 'completed',
            },
        ] as any

        mockCoAStatus.mockResolvedValueOnce({ status: 'ready' })
        mockQCStatus.mockReturnValue(new Promise(() => {}) as any)

        const { result, rerender } = renderHook(
            ({ id, seededResults }) =>
                useAssignedTestsData(id, {
                    initialResults: seededResults,
                }),
            {
                initialProps: {
                    id: 'sample-A',
                    seededResults: initialResults,
                },
            },
        )

        await waitFor(() => expect(result.current.coaStatus).toBe('ready'))

        act(() => {
            rerender({
                id: 'sample-A',
                seededResults: initialResults.map((result: any) => ({ ...result })),
            })
        })

        expect(result.current.coaStatus).toBe('ready')
        await waitFor(() => expect(mockCoAStatus).toHaveBeenCalledTimes(1))
    })

    it('ignores stale CoA responses from the previous sample', async () => {
        let resolveCoAStatus!: (value: { status: 'ready' }) => void
        const staleCoAStatus = new Promise<{ status: 'ready' }>((resolve) => {
            resolveCoAStatus = resolve
        })

        mockFetch
            .mockResolvedValueOnce({
                data: [{ id: 'r-A', assay_id: 'a1', sample_status: 'completed' }],
                error: null,
            })
            .mockResolvedValueOnce({
                data: [{ id: 'r-B', assay_id: 'a2', sample_status: 'assigned' }],
                error: null,
            })
        mockCoAStatus.mockReturnValueOnce(staleCoAStatus as any)

        const { result, rerender } = renderHook(
            ({ id }) => useAssignedTestsData(id),
            { initialProps: { id: 'sample-A' } },
        )

        await waitFor(() => expect(mockCoAStatus).toHaveBeenCalledWith('sample-A'))

        rerender({ id: 'sample-B' })

        await waitFor(() => expect(result.current.loading).toBe(false))
        await waitFor(() => expect(result.current.sampleStatus).toBe('assigned'))

        await act(async () => {
            resolveCoAStatus({ status: 'ready' })
            await staleCoAStatus
        })

        expect(result.current.coaStatus).toBeNull()
    })

    it('fetches CoA status when sampleStatus is completed', async () => {
        mockFetch.mockResolvedValue({
            data: [{ id: 'r1', assay_id: 'a1', sample_status: 'completed' }],
            error: null,
        })
        mockCoAStatus.mockResolvedValue({ status: 'ready' })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() => expect(result.current.coaStatus).toBe('ready'))
        expect(mockCoAStatus).toHaveBeenCalledWith('sample-1')
    })

    it('reports enrichment loading after fetched completed results start CoA and QC requests', async () => {
        mockFetch.mockResolvedValue({
            data: [{ id: 'r1', assay_id: 'a1', sample_status: 'completed' }],
            error: null,
        })
        mockCoAStatus.mockReturnValue(new Promise(() => {}) as any)
        mockQCStatus.mockReturnValue(new Promise(() => {}) as any)

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() => expect(mockCoAStatus).toHaveBeenCalledWith('sample-1'))
        expect(result.current.loading).toBe(false)
        expect(result.current.enrichmentLoading).toBe(true)
    })

    it('fetches QC statuses when results are loaded', async () => {
        mockFetch.mockResolvedValue({
            data: [
                { id: 'r1', assay_id: 'a1', sample_status: 'assigned' },
                { id: 'r2', assay_id: 'a2', sample_status: 'assigned' },
            ],
            error: null,
        })
        mockQCStatus.mockResolvedValue({
            a1: { status: 'pass', message: 'OK', last_qc_at: null },
        })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() => expect(Object.keys(result.current.qcStatuses).length).toBeGreaterThan(0))
        expect(mockQCStatus).toHaveBeenCalledWith(['a1', 'a2'])
    })

    it('clears QC statuses when switching to a sample without results', async () => {
        const qcStatusResult = {
            a1: { status: 'pass', message: 'OK', last_qc_at: null },
        }

        mockFetch
            .mockResolvedValueOnce({
                data: [{ id: 'r-A', assay_id: 'a1', sample_status: 'assigned' }],
                error: null,
            })
            .mockResolvedValueOnce({ data: [], error: null })
        mockQCStatus.mockResolvedValueOnce(qcStatusResult)

        const { result, rerender } = renderHook(
            ({ id }) => useAssignedTestsData(id),
            { initialProps: { id: 'sample-A' } },
        )

        await waitFor(() => expect(result.current.qcStatuses).toEqual(qcStatusResult))

        rerender({ id: 'sample-B' })

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.qcStatuses).toEqual({})
    })

    it('ignores stale QC responses after switching to a sample without QC data', async () => {
        let resolveFirstQC!: (value: Record<string, { status: string; message: string; last_qc_at: null }>) => void
        const firstQCResponse = new Promise<Record<string, { status: string; message: string; last_qc_at: null }>>((resolve) => {
            resolveFirstQC = resolve
        })

        mockFetch
            .mockResolvedValueOnce({
                data: [{ id: 'r-A', assay_id: 'a1', sample_status: 'assigned' }],
                error: null,
            })
            .mockResolvedValueOnce({ data: [], error: null })
        mockQCStatus.mockReturnValueOnce(firstQCResponse as any)

        const { result, rerender } = renderHook(
            ({ id }) => useAssignedTestsData(id),
            { initialProps: { id: 'sample-A' } },
        )

        await waitFor(() => expect(mockQCStatus).toHaveBeenCalledWith(['a1']))

        rerender({ id: 'sample-B' })

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.qcStatuses).toEqual({})

        await act(async () => {
            resolveFirstQC({
                a1: { status: 'pass', message: 'Stale', last_qc_at: null },
            })
            await firstQCResponse
        })

        expect(result.current.qcStatuses).toEqual({})
    })

    it('clears enrichmentError after a successful QC refetch for the same sample', async () => {
        const firstResults = [{ id: 'r1', assay_id: 'a1', sample_status: 'assigned' }]
        const secondResults = [{ id: 'r1', assay_id: 'a1', sample_status: 'assigned' }]

        mockFetch
            .mockResolvedValueOnce({
                data: firstResults,
                error: null,
            })
            .mockResolvedValueOnce({
                data: secondResults,
                error: null,
            })
        mockQCStatus
            .mockRejectedValueOnce(new Error('QC unavailable'))
            .mockResolvedValueOnce({
                a1: { status: 'pass', message: 'OK', last_qc_at: null },
            })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() =>
            expect(result.current.enrichmentError).toBe('Không thể tải trạng thái bổ sung'),
        )

        await act(async () => {
            await result.current.fetchTests()
        })

        await waitFor(() => expect(result.current.enrichmentError).toBeNull())
    })

    it('exposes fetchTests for manual refetch', async () => {
        mockFetch.mockResolvedValue({ data: [], error: null })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(typeof result.current.fetchTests).toBe('function')

        // Manual refetch
        await act(async () => { await result.current.fetchTests() })
        expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('ignores out-of-order refetch responses for the same sample', async () => {
        let resolveFirstFetch!: (value: { data: Array<{ id: string; assay_id: string; sample_status: string }>; error: null }) => void
        const firstFetch = new Promise<{ data: Array<{ id: string; assay_id: string; sample_status: string }>; error: null }>((resolve) => {
            resolveFirstFetch = resolve
        })

        mockFetch
            .mockReturnValueOnce(firstFetch as any)
            .mockResolvedValueOnce({
                data: [{ id: 'r-new', assay_id: 'a2', sample_status: 'assigned' }],
                error: null,
            })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await act(async () => {
            await result.current.fetchTests()
        })

        expect(result.current.results[0]?.id).toBe('r-new')

        await act(async () => {
            resolveFirstFetch({
                data: [{ id: 'r-old', assay_id: 'a1', sample_status: 'completed' }],
                error: null,
            })
            await firstFetch
        })

        expect(result.current.results[0]?.id).toBe('r-new')
    })
})
