/**
 * Tests for useAssignedTestsData hook.
 *
 * Verifies data fetching, race-condition guard, CoA status,
 * and QC status fetching extracted from AssignedTestsPanel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('useAssignedTestsData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetch.mockResolvedValue({ data: [], error: null })
        mockCoAStatus.mockResolvedValue({ status: null })
        mockQCStatus.mockResolvedValue({})
    })

    it('returns loading=true initially', () => {
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
        let resolveFirst: (v: any) => void
        const slowPromise = new Promise((r) => { resolveFirst = r })
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
        resolveFirst!({
            data: [{ id: 'r-A', assay_id: 'a1', sample_status: 'completed' }],
            error: null,
        })

        // Should show sample-B data, not stale sample-A
        expect(result.current.results[0]?.id).toBe('r-B')
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

    it('exposes fetchTests for manual refetch', async () => {
        mockFetch.mockResolvedValue({ data: [], error: null })

        const { result } = renderHook(() => useAssignedTestsData('sample-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(typeof result.current.fetchTests).toBe('function')

        // Manual refetch
        await act(async () => { await result.current.fetchTests() })
        expect(mockFetch).toHaveBeenCalledTimes(2)
    })
})
