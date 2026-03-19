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
        mockSearchParams = new URLSearchParams('scope=all&sortBy=received_at&sortOrder=asc&pageSize=50')

        const { result, rerender } = renderHook(() => useFilterParams())

        expect(result.current.filters.scope).toBe('all')

        act(() => {
            result.current.handlers.setScope('active')
        })

        expect(mockReplace.mock.calls.at(-1)?.[0]).not.toContain('scope=')

        rerender()

        expect(result.current.filters.scope).toBe('active')
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
})
