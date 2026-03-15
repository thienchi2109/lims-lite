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
    it('renders nothing on SSR where effects do not run (prevents portal flash)', () => {
        // In SSR, useEffect doesn't fire, so hasMounted stays false.
        // Even if useMediaQuery returns false (mobile), children must not render.
        mockUseMediaQuery.mockReturnValue(false)

        // renderToString does not run useEffect — simulates the SSR/initial paint
        const { renderToString } = require('react-dom/server')
        const html = renderToString(
            <MobileOnly>
                <div data-testid="child">Mobile content</div>
            </MobileOnly>,
        )

        expect(html).toBe('')
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
