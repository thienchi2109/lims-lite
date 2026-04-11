import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockSearchParams = new URLSearchParams()
const mockReplace = vi.fn((url: string) => {
    const query = url.includes('?') ? url.split('?')[1] : ''
    mockSearchParams = new URLSearchParams(query)
})
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: mockPush }),
    useSearchParams: () => mockSearchParams,
    usePathname: () => '/manager/samples',
}))

import { useFilterParams } from './use-filter-params'

describe('useFilterParams scope state', () => {
    beforeEach(() => {
        mockReplace.mockClear()
        mockPush.mockClear()
        mockSearchParams = new URLSearchParams()
    })

    it('defaults missing scope to active and round-trips scope=all in the URL', () => {
        mockSearchParams = new URLSearchParams('sortBy=received_at&sortOrder=asc&pageSize=50')

        const { result, rerender } = renderHook(() => useFilterParams())

        expect(result.current.filters.scope).toBe('active')

        act(() => {
            result.current.handlers.setScope('all')
        })

        expect(mockReplace).toHaveBeenCalledWith(
            expect.stringContaining('/manager/samples?'),
        )
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('scope=all'))
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('page=1'))

        rerender()

        expect(result.current.filters.scope).toBe('all')
    })

    it('clears scope from the URL when switched back to the active default', () => {
        mockSearchParams = new URLSearchParams(
            'scope=all&status=completed&search=ABC&fromDate=2026-01-01&toDate=2026-01-31&receiverId=11111111-1111-4111-8111-111111111111&specialtyIds=22222222-2222-4222-8222-222222222222&sortBy=received_at&sortOrder=asc&pageSize=50',
        )

        const { result, rerender } = renderHook(() => useFilterParams())

        expect(result.current.filters.scope).toBe('all')

        act(() => {
            result.current.handlers.setScope('active')
        })

        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('scope=')
        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('status=completed')
        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('search=ABC')
        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('fromDate=2026-01-01')
        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('toDate=2026-01-31')
        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('receiverId=11111111-1111-4111-8111-111111111111')
        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('specialtyIds=22222222-2222-4222-8222-222222222222')

        rerender()

        expect(result.current.filters.scope).toBe('active')
    })

    it('keeps a remembered all-scope selection when status is temporarily overridden and cleared', () => {
        mockSearchParams = new URLSearchParams('scope=all&sortBy=received_at&sortOrder=asc&pageSize=50&page=3')

        const { result, rerender } = renderHook(() => useFilterParams())

        expect(result.current.filters.scope).toBe('all')
        expect(result.current.filters.status).toBe('all')

        act(() => {
            result.current.handlers.setStatus('completed')
        })

        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('scope=all')
        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('status=completed')

        rerender()

        expect(result.current.filters.scope).toBe('all')
        expect(result.current.filters.status).toBe('completed')

        act(() => {
            result.current.handlers.setStatus('all')
        })

        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('scope=all')
        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('status=')
        expect(mockReplace.mock.calls.at(-1)?.[0]).toContain('page=1')

        rerender()

        expect(result.current.filters.scope).toBe('all')
        expect(result.current.filters.status).toBe('all')
    })

    it('removes scope during reset while preserving sort and page size', () => {
        mockSearchParams = new URLSearchParams(
            'scope=all&status=completed&search=ABC&fromDate=2026-01-01&toDate=2026-01-31&receiverId=11111111-1111-4111-8111-111111111111&specialtyIds=22222222-2222-4222-8222-222222222222&sortBy=received_at&sortOrder=asc&pageSize=50&page=3',
        )

        const { result } = renderHook(() => useFilterParams())

        act(() => {
            result.current.handlers.resetFilters()
        })

        expect(mockReplace).toHaveBeenCalledWith(
            expect.stringContaining('/manager/samples?'),
        )
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('sortBy=received_at'))
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('sortOrder=asc'))
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('pageSize=50'))
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('page=1'))
        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('scope=')
        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('status=')
        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('search=')
        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('fromDate=')
        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('toDate=')
        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('receiverId=')
        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('specialtyIds=')
        expect(result.current.sort.sortBy).toBe('received_at')
        expect(result.current.sort.sortOrder).toBe('asc')
        expect(result.current.sort.pageSize).toBe(50)
    })

    it('syncs search from external URL changes when the search input is not focused', () => {
        mockSearchParams = new URLSearchParams('search=ABC')

        const { result, rerender } = renderHook(() => useFilterParams())

        expect(result.current.filters.search).toBe('ABC')

        mockSearchParams = new URLSearchParams('search=DEF')
        rerender()

        expect(result.current.filters.search).toBe('DEF')
    })

    it('preserves the local search draft while the search input is focused', () => {
        mockSearchParams = new URLSearchParams('search=ABC')
        const focusedInput = document.createElement('input')
        focusedInput.dataset.searchInput = 'true'
        document.body.appendChild(focusedInput)
        focusedInput.focus()

        const { result, rerender } = renderHook(() => useFilterParams())

        act(() => {
            result.current.handlers.setSearch('LOCAL')
        })

        mockSearchParams = new URLSearchParams('search=SERVER')
        rerender()

        expect(result.current.filters.search).toBe('LOCAL')
        focusedInput.remove()
    })

    it('delegates filter updates through the shared query updater and exposes pending state', () => {
        const updateQuery = vi.fn()

        const { result } = renderHook(() =>
            useFilterParams({
                updateQuery,
                isPending: true,
            }),
        )

        act(() => {
            result.current.handlers.setReceiver('11111111-1111-4111-8111-111111111111')
        })

        expect(updateQuery).toHaveBeenCalledWith(
            { receiverId: '11111111-1111-4111-8111-111111111111' },
            'filter',
        )
        expect(result.current.isPending).toBe(true)
    })
})
