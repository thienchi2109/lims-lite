/**
 * Tests for AssignedTestsToolbar mobile overflow behavior.
 * Verifies that secondary actions collapse into a "⋯" dropdown on mobile.
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mockStartTour = vi.hoisted(() => vi.fn())

// Mock UI components that are complex
vi.mock('@/components/coa-status-badge', () => ({
    CoAStatusBadge: ({ status }: any) => <span data-testid="coa-badge">{status}</span>,
}))
vi.mock('@/components/walkthrough', () => ({
    WalkthroughTrigger: () => <button data-testid="walkthrough-trigger">Walkthrough Trigger</button>,
    useWalkthrough: () => ({
        startTour: mockStartTour,
        isReady: true,
        isActive: false,
        tourStatus: null,
    }),
}))
vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: any) => <>{children}</>,
    TooltipContent: ({ children }: any) => <span>{children}</span>,
    TooltipTrigger: ({ children }: any) => <>{children}</>,
}))
vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
    DropdownMenuItem: ({ children, onClick }: any) => (
        <button data-testid="dropdown-item" onClick={onClick}>{children}</button>
    ),
    DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
}))
vi.mock('next/link', () => ({
    default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

import { AssignedTestsToolbar } from '../assigned-tests-toolbar'

const defaultProps = {
    resultsCount: 3,
    sampleStatus: 'review' as const,
    coaStatus: null,
    canSubmitForReview: false,
    hasPendingChanges: false,
    hasSignature: true,
    signatureLoading: false,
    isGeneratingCoA: false,
    onPrint: vi.fn(),
    onGenerateCoA: vi.fn(),
    onSubmitForReview: vi.fn(),
    onOpenAssignment: vi.fn(),
    onPreviewCoA: vi.fn(),
    onPrintCoABody: vi.fn(),
    userRole: 'manager' as const,
}

describe('AssignedTestsToolbar mobile overflow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders a mobile overflow menu button', () => {
        render(<AssignedTestsToolbar {...defaultProps} />)

        // Should render a button with the overflow icon for mobile
        const overflowButton = screen.getByTestId('mobile-overflow-menu')
        expect(overflowButton).toBeDefined()
    })

    it('overflow menu has hidden sm:flex class for mobile-only visibility', () => {
        render(<AssignedTestsToolbar {...defaultProps} />)

        const overflowButton = screen.getByTestId('mobile-overflow-menu')
        // The button should only be visible on mobile (flex sm:hidden pattern)
        expect(overflowButton.className).toContain('sm:hidden')
    })

    it('hides standalone walkthrough trigger on mobile', () => {
        render(<AssignedTestsToolbar {...defaultProps} />)

        const walkthrough = screen.getByTestId('walkthrough-trigger')
        // Standalone trigger is desktop-only and wrapped with mobile-hidden classes.
        const parent = walkthrough.closest('[class]')
        expect(parent?.className ?? '').toContain('hidden')
    })

    it('includes walkthrough action in mobile overflow menu', () => {
        render(<AssignedTestsToolbar {...defaultProps} />)

        expect(screen.getByText('Hướng dẫn')).toBeDefined()
    })

    it('always shows the results count badge', () => {
        render(<AssignedTestsToolbar {...defaultProps} />)

        expect(screen.getByText('3')).toBeDefined()
    })

    it('exposes ready CoA actions in the mobile overflow menu', () => {
        render(
            <AssignedTestsToolbar
                {...defaultProps}
                sampleStatus="completed"
                coaStatus="ready"
            />,
        )

        expect(screen.getByTestId('mobile-overflow-menu')).toBeDefined()
        expect(screen.getAllByText('Xem CoA đầy đủ').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Chỉ in bảng kết quả').length).toBeGreaterThan(0)

        fireEvent.click(screen.getAllByText('Xem CoA đầy đủ')[0])
        fireEvent.click(screen.getAllByText('Chỉ in bảng kết quả')[0])

        expect(defaultProps.onPreviewCoA).toHaveBeenCalledTimes(1)
        expect(defaultProps.onPrintCoABody).toHaveBeenCalledTimes(1)
    })
})
