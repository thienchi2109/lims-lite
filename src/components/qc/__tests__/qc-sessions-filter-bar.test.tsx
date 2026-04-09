import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QCSessionsFilterBar } from '../qc-sessions-filter-bar'

const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
    usePathname: () => '/manager/quality-control',
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => mockSearchParams,
}))

vi.mock('lucide-react', () => ({
    Filter: () => <span data-testid="filter-icon" />,
    Search: () => <span data-testid="search-icon" />,
}))

describe('QCSessionsFilterBar', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockPush.mockClear()
        mockSearchParams = new URLSearchParams('sess_status=pass&sess_search=ALT')
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('debounces search updates while preserving existing session filters', () => {
        render(<QCSessionsFilterBar specialties={[]} assays={[]} />)

        fireEvent.change(screen.getByPlaceholderText('Tìm theo tên xét nghiệm...'), {
            target: { value: 'HbA1c' },
        })

        expect(mockPush).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(300)
        })

        expect(mockPush).toHaveBeenCalledWith(
            '/manager/quality-control?sess_status=pass&sess_search=HbA1c',
            { scroll: false }
        )
    })

    it('syncs search input from external URL changes', () => {
        const { rerender } = render(<QCSessionsFilterBar specialties={[]} assays={[]} />)

        expect(screen.getByDisplayValue('ALT')).toBeDefined()

        mockSearchParams = new URLSearchParams('sess_search=AST')
        rerender(<QCSessionsFilterBar specialties={[]} assays={[]} />)

        expect(screen.getByDisplayValue('AST')).toBeDefined()
    })

    it('normalizes invalid pagination params before writing filter changes', () => {
        mockSearchParams = new URLSearchParams('sess_page=wat&sess_size=nope&sess_search=ALT')
        render(<QCSessionsFilterBar specialties={[]} assays={[]} />)

        fireEvent.change(screen.getByPlaceholderText('Tìm theo tên xét nghiệm...'), {
            target: { value: 'HbA1c' },
        })

        act(() => {
            vi.advanceTimersByTime(300)
        })

        expect(mockPush).toHaveBeenCalledWith(
            '/manager/quality-control?sess_search=HbA1c',
            { scroll: false }
        )
    })

    it('ignores invalid session status and mode params before writing filter changes', () => {
        mockSearchParams = new URLSearchParams('sess_status=bogus&sess_mode=hacked&sess_search=ALT')
        render(<QCSessionsFilterBar specialties={[]} assays={[]} />)

        fireEvent.change(screen.getByPlaceholderText('Tìm theo tên xét nghiệm...'), {
            target: { value: 'HbA1c' },
        })

        act(() => {
            vi.advanceTimersByTime(300)
        })

        expect(mockPush).toHaveBeenCalledWith(
            '/manager/quality-control?sess_search=HbA1c',
            { scroll: false }
        )
    })

    it('keeps the pending session search draft when unrelated params change', () => {
        mockSearchParams = new URLSearchParams('outside=1&sess_status=pass&sess_search=ALT')
        const { rerender } = render(<QCSessionsFilterBar specialties={[]} assays={[]} />)

        fireEvent.change(screen.getByPlaceholderText('Tìm theo tên xét nghiệm...'), {
            target: { value: 'HbA1c' },
        })

        mockSearchParams = new URLSearchParams('outside=2&sess_status=pass&sess_search=ALT')
        rerender(<QCSessionsFilterBar specialties={[]} assays={[]} />)

        expect(screen.getByDisplayValue('HbA1c')).toBeDefined()

        act(() => {
            vi.advanceTimersByTime(300)
        })

        expect(mockPush).toHaveBeenCalledWith(
            '/manager/quality-control?outside=2&sess_status=pass&sess_search=HbA1c',
            { scroll: false }
        )
    })
})
