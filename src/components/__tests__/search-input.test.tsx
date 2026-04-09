import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchInput } from '../ui/search-input'

const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
    usePathname: () => '/manager/samples',
    useRouter: () => ({ replace: mockReplace }),
    useSearchParams: () => mockSearchParams,
}))

vi.mock('lucide-react', () => ({
    Search: () => <span data-testid="search-icon" />,
}))

describe('SearchInput', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockReplace.mockClear()
        mockSearchParams = new URLSearchParams('search=ABC&page=3')
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('debounces search URL updates and resets page to 1', () => {
        render(<SearchInput />)

        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'XYZ' } })

        act(() => {
            vi.advanceTimersByTime(300)
        })

        expect(mockReplace).toHaveBeenCalledWith('/manager/samples?search=XYZ&page=1')
    })

    it('syncs the input when search params change externally', () => {
        const { rerender } = render(<SearchInput />)

        expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('ABC')

        mockSearchParams = new URLSearchParams('search=DEF&page=2')
        rerender(<SearchInput />)

        expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('DEF')
    })
})
