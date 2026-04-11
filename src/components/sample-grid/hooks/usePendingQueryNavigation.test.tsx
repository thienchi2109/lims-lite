import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { usePendingQueryNavigation } from './usePendingQueryNavigation'

describe('usePendingQueryNavigation', () => {
    it('starts a page transition and clears only after the target query settles', () => {
        const replace = vi.fn()

        const { result, rerender } = renderHook(
            ({ currentQuery, isFetching }: { currentQuery: string; isFetching: boolean }) =>
                usePendingQueryNavigation({
                    currentQuery,
                    pathname: '/manager/samples',
                    replace,
                    isFetching,
                }),
            {
                initialProps: {
                    currentQuery: 'status=received',
                    isFetching: false,
                },
            },
        )

        act(() => {
            result.current.updateQuery({ page: '2' }, 'page')
        })

        expect(replace).toHaveBeenCalledWith('/manager/samples?status=received&page=2')
        expect(result.current.pendingAction).toBe('page')
        expect(result.current.isPending).toBe(true)
        expect(result.current.isPagePending).toBe(true)
        expect(result.current.isFilterPending).toBe(false)

        rerender({
            currentQuery: 'status=received&page=2',
            isFetching: true,
        })

        expect(result.current.isPending).toBe(true)
        expect(result.current.pendingAction).toBe('page')

        rerender({
            currentQuery: 'status=received&page=2',
            isFetching: false,
        })

        expect(result.current.isPending).toBe(false)
        expect(result.current.pendingAction).toBe(null)
    })

    it('tracks filter transitions separately from page transitions', () => {
        const replace = vi.fn()

        const { result, rerender } = renderHook(
            ({ currentQuery, isFetching }: { currentQuery: string; isFetching: boolean }) =>
                usePendingQueryNavigation({
                    currentQuery,
                    pathname: '/manager/samples',
                    replace,
                    isFetching,
                }),
            {
                initialProps: {
                    currentQuery: '',
                    isFetching: false,
                },
            },
        )

        act(() => {
            result.current.updateQuery({ receiverId: '11111111-1111-4111-8111-111111111111' }, 'filter')
        })

        expect(replace).toHaveBeenCalledWith(
            '/manager/samples?receiverId=11111111-1111-4111-8111-111111111111&page=1',
        )
        expect(result.current.isFilterPending).toBe(true)
        expect(result.current.isPagePending).toBe(false)
        expect(result.current.pendingAction).toBe('filter')

        rerender({
            currentQuery: 'receiverId=11111111-1111-4111-8111-111111111111&page=1',
            isFetching: false,
        })

        expect(result.current.isPending).toBe(false)
    })

    it('does not trigger a transition when the target query matches the current query', () => {
        const replace = vi.fn()

        const { result } = renderHook(() =>
            usePendingQueryNavigation({
                currentQuery: 'page=2&status=received',
                pathname: '/manager/samples',
                replace,
                isFetching: false,
            }),
        )

        act(() => {
            result.current.updateQuery({ page: '2' }, 'page')
        })

        expect(replace).not.toHaveBeenCalled()
        expect(result.current.isPending).toBe(false)
        expect(result.current.pendingAction).toBe(null)
    })

    it('does not revive a settled page transition when selecting a sample row changes detail params', () => {
        const replace = vi.fn()

        const { result, rerender } = renderHook(
            ({ currentQuery, isFetching }: { currentQuery: string; isFetching: boolean }) =>
                usePendingQueryNavigation({
                    currentQuery,
                    pathname: '/manager/samples',
                    replace,
                    isFetching,
                }),
            {
                initialProps: {
                    currentQuery: 'page=1',
                    isFetching: false,
                },
            },
        )

        act(() => {
            result.current.updateQuery({ page: '2' }, 'page')
        })

        rerender({
            currentQuery: 'page=2',
            isFetching: false,
        })

        expect(result.current.pendingAction).toBe(null)

        rerender({
            currentQuery: 'page=2&sampleId=sample-2',
            isFetching: false,
        })

        expect(result.current.pendingAction).toBe(null)
        expect(result.current.isPending).toBe(false)
    })
})
