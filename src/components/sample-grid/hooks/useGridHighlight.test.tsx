import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGridHighlight } from './useGridHighlight'

describe('useGridHighlight', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('skips initial animation and highlights rows when their timestamp changes', async () => {
        const { result, rerender } = renderHook(
            ({ rows }) => useGridHighlight(rows, { highlightDuration: 1000 }),
            {
                initialProps: {
                    rows: [{ id: 'sample-1', updated_at: '2026-01-01T00:00:00Z' }],
                },
            },
        )

        expect(result.current.has('sample-1')).toBe(false)

        rerender({
            rows: [{ id: 'sample-1', updated_at: '2026-01-01T00:01:00Z' }],
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(result.current.has('sample-1')).toBe(true)

        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(result.current.has('sample-1')).toBe(false)
    })

    it('can highlight rows on initial mount when configured', async () => {
        const { result } = renderHook(() =>
            useGridHighlight(
                [{ id: 'sample-1', updated_at: '2026-01-01T00:00:00Z' }],
                { highlightDuration: 1000, skipInitialAnimation: false },
            ),
        )

        await act(async () => {
            await Promise.resolve()
        })

        expect(result.current.has('sample-1')).toBe(true)
    })
})
