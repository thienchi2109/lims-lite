/**
 * Tests for AssignedTestsToolbar mobile overflow behavior.
 * Verifies that secondary actions collapse into a "⋯" dropdown on mobile.
 */

import { Children, isValidElement } from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

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
const hasDescendantDataTestId = (node: any, testId: string): boolean =>
    Children.toArray(node).some((child) => {
        if (!isValidElement(child)) {
            return false
        }

        if (child.props?.['data-testid'] === testId) {
            return true
        }

        return hasDescendantDataTestId(child.props?.children, testId)
    })

const MockDropdownMenuTrigger = vi.hoisted(() => {
    return ({ children }: any) => <>{children}</>
})

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: any) => {
        const menuTrigger = Children.toArray(children).find(
            (child) => isValidElement(child) && child.type === MockDropdownMenuTrigger,
        )
        const menuVariant =
            isValidElement(menuTrigger) && hasDescendantDataTestId(menuTrigger.props.children, 'mobile-overflow-menu')
                ? 'mobile'
                : 'desktop'

        return <div data-testid={`${menuVariant}-dropdown-menu`}>{children}</div>
    },
    DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: any) => (
        <button data-testid="dropdown-item" onClick={onClick}>
            {children}
        </button>
    ),
    DropdownMenuTrigger: MockDropdownMenuTrigger,
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

        const mobileMenu = screen.getByTestId('mobile-dropdown-menu')
        expect(within(mobileMenu).getByTestId('mobile-overflow-menu')).toBeDefined()
        expect(within(mobileMenu).getByRole('button', { name: 'Xem CoA đầy đủ' })).toBeDefined()
        expect(within(mobileMenu).getByRole('button', { name: 'Chỉ in bảng kết quả' })).toBeDefined()

        fireEvent.click(within(mobileMenu).getByRole('button', { name: 'Xem CoA đầy đủ' }))
        fireEvent.click(within(mobileMenu).getByRole('button', { name: 'Chỉ in bảng kết quả' }))

        expect(defaultProps.onPreviewCoA).toHaveBeenCalledTimes(1)
        expect(defaultProps.onPrintCoABody).toHaveBeenCalledTimes(1)
    })

    it('hides mobile CoA actions until the sample is completed and CoA is ready', () => {
        render(
            <AssignedTestsToolbar
                {...defaultProps}
                sampleStatus="review"
                coaStatus="ready"
            />,
        )

        const mobileMenu = screen.getByTestId('mobile-dropdown-menu')
        expect(within(mobileMenu).queryByRole('button', { name: 'Xem CoA đầy đủ' })).toBeNull()
        expect(within(mobileMenu).queryByRole('button', { name: 'Chỉ in bảng kết quả' })).toBeNull()
    })
})
