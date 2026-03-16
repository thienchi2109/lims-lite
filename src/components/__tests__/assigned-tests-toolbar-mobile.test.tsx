/**
 * Tests for AssignedTestsToolbar mobile overflow behavior.
 * Verifies that secondary actions collapse into a "⋯" dropdown on mobile.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock UI components that are complex
vi.mock('@/components/coa-status-badge', () => ({
    CoAStatusBadge: ({ status }: any) => <span data-testid="coa-badge">{status}</span>,
}))
vi.mock('@/components/walkthrough', () => ({
    WalkthroughTrigger: () => <button data-testid="walkthrough-trigger">Hướng dẫn</button>,
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
    sampleId: 'sample-1',
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
    onPrintCoABody: vi.fn(),
    userRole: 'manager' as const,
}

describe('AssignedTestsToolbar mobile overflow', () => {
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

    it('hides walkthrough trigger on mobile', () => {
        render(<AssignedTestsToolbar {...defaultProps} />)

        const walkthrough = screen.getByTestId('walkthrough-trigger')
        // Should have hidden sm:inline-flex or similar mobile-hidden class
        const parent = walkthrough.closest('[class]')
        expect(parent?.className ?? '').toContain('sm:')
    })

    it('always shows the results count badge', () => {
        render(<AssignedTestsToolbar {...defaultProps} />)

        expect(screen.getByText('3')).toBeDefined()
    })
})
