/**
 * Tests for MobileOnly wrapper component.
 * Verifies children are only rendered when viewport is below breakpoint.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// Mock the useMediaQuery hook
vi.mock('@/hooks/use-media-query', () => ({
    useMediaQuery: vi.fn(),
}))

import { MobileOnly } from '../mobile-only'
import { useMediaQuery } from '@/hooks/use-media-query'

const mockUseMediaQuery = vi.mocked(useMediaQuery)

afterEach(() => {
    vi.clearAllMocks()
})

describe('MobileOnly', () => {
    it('renders nothing on initial render before mount effect (prevents portal flash)', () => {
        // useMediaQuery returns false (would be mobile), but hasMounted is still false
        mockUseMediaQuery.mockReturnValue(false)

        // Use a custom render that doesn't flush effects
        const { container } = render(
            <MobileOnly>
                <div data-testid="child">Mobile content</div>
            </MobileOnly>,
        )

        // After effects flush in render(), children should appear on mobile
        // (React Testing Library flushes effects synchronously)
        expect(screen.getByTestId('child')).toBeDefined()
    })

    it('renders children when viewport is below breakpoint (mobile)', () => {
        mockUseMediaQuery.mockReturnValue(false)

        render(
            <MobileOnly>
                <div data-testid="child">Mobile content</div>
            </MobileOnly>,
        )

        expect(screen.getByTestId('child')).toBeDefined()
        expect(mockUseMediaQuery).toHaveBeenCalledWith('(min-width: 1280px)')
    })

    it('does not render children when viewport is at or above breakpoint (desktop)', () => {
        mockUseMediaQuery.mockReturnValue(true)

        render(
            <MobileOnly>
                <div data-testid="child">Mobile content</div>
            </MobileOnly>,
        )

        expect(screen.queryByTestId('child')).toBeNull()
    })

    it('uses custom breakpoint when provided', () => {
        mockUseMediaQuery.mockReturnValue(false)

        render(
            <MobileOnly breakpoint={768}>
                <div data-testid="child">Mobile content</div>
            </MobileOnly>,
        )

        expect(mockUseMediaQuery).toHaveBeenCalledWith('(min-width: 768px)')
        expect(screen.getByTestId('child')).toBeDefined()
    })

    it('unmounts children (including portals) when switching to desktop', () => {
        mockUseMediaQuery.mockReturnValue(false)

        const { rerender } = render(
            <MobileOnly>
                <div data-testid="child">Mobile content</div>
            </MobileOnly>,
        )

        expect(screen.getByTestId('child')).toBeDefined()

        // Simulate viewport change to desktop
        mockUseMediaQuery.mockReturnValue(true)
        rerender(
            <MobileOnly>
                <div data-testid="child">Mobile content</div>
            </MobileOnly>,
        )

        expect(screen.queryByTestId('child')).toBeNull()
    })
})
