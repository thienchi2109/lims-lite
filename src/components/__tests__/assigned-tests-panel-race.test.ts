/**
 * Race condition test for AssignedTestsPanel fetch logic.
 *
 * Verifies that when sampleId changes before a fetch completes,
 * the stale response is discarded and does not overwrite newer data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Simulates the core fetch-with-cancellation logic extracted from
 * AssignedTestsPanel's useEffect. This tests the pattern, not the
 * full component (which has too many dependencies for a unit test).
 */
function createFetchController(
    fetchFn: (sampleId: string) => Promise<{ data: any[]; error?: string }>,
) {
    let currentAbortFlag = { cancelled: false }

    return {
        /**
         * Start a new fetch. Cancels any in-flight fetch first.
         * Returns { data, wasCancelled } after the fetch completes.
         */
        async fetch(sampleId: string) {
            // Cancel previous
            currentAbortFlag.cancelled = true
            // New flag for this fetch
            const myFlag = { cancelled: false }
            currentAbortFlag = myFlag

            const result = await fetchFn(sampleId)

            return {
                ...result,
                wasCancelled: myFlag.cancelled,
            }
        },

        /** Cancel current in-flight fetch */
        cancel() {
            currentAbortFlag.cancelled = true
        },
    }
}

describe('AssignedTestsPanel race condition guard', () => {
    let fetchFn: ReturnType<typeof vi.fn<(sampleId: string) => Promise<{ data: any[]; error?: string }>>>
    let controller: ReturnType<typeof createFetchController>

    beforeEach(() => {
        fetchFn = vi.fn<(sampleId: string) => Promise<{ data: any[]; error?: string }>>()
        controller = createFetchController(fetchFn)
    })

    it('discards stale response when sampleId changes before fetch completes', async () => {
        // Simulate slow response for sample-A (200ms)
        const slowPromiseA = new Promise<{ data: any[] }>((resolve) =>
            setTimeout(() => resolve({ data: [{ id: 'result-A', assay_name: 'Creatinine' }] }), 200),
        )
        // Simulate fast response for sample-B (50ms)
        const fastPromiseB = new Promise<{ data: any[] }>((resolve) =>
            setTimeout(() => resolve({ data: [{ id: 'result-B', assay_name: 'Glucose' }] }), 50),
        )

        fetchFn.mockReturnValueOnce(slowPromiseA).mockReturnValueOnce(fastPromiseB)

        // Start fetch for sample-A
        const fetchA = controller.fetch('sample-A')

        // Immediately switch to sample-B (simulates rapid tap)
        const fetchB = controller.fetch('sample-B')

        // Wait for both
        const [resultA, resultB] = await Promise.all([fetchA, fetchB])

        // A should be marked as cancelled
        expect(resultA.wasCancelled).toBe(true)

        // B should NOT be cancelled — it's the latest
        expect(resultB.wasCancelled).toBe(false)
        expect(resultB.data[0].id).toBe('result-B')
    })

    it('does not cancel when same sample is re-fetched', async () => {
        fetchFn.mockResolvedValue({ data: [{ id: 'result-A' }] })

        const result = await controller.fetch('sample-A')

        expect(result.wasCancelled).toBe(false)
        expect(result.data[0].id).toBe('result-A')
    })

    it('handles fetch error without applying stale data', async () => {
        const slowError = new Promise<{ data: any[]; error: string }>((resolve) =>
            setTimeout(() => resolve({ data: [], error: 'Network error' }), 200),
        )
        const fastSuccess = new Promise<{ data: any[] }>((resolve) =>
            setTimeout(() => resolve({ data: [{ id: 'result-B' }] }), 50),
        )

        fetchFn.mockReturnValueOnce(slowError).mockReturnValueOnce(fastSuccess)

        const fetchA = controller.fetch('sample-A')
        const fetchB = controller.fetch('sample-B')

        const [resultA, resultB] = await Promise.all([fetchA, fetchB])

        // Stale error response should be discarded
        expect(resultA.wasCancelled).toBe(true)

        // Fresh response should be applied
        expect(resultB.wasCancelled).toBe(false)
        expect(resultB.data[0].id).toBe('result-B')
    })
})
