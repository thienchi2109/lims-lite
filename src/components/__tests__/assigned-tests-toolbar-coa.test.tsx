/**
 * Tests for AssignedTestsToolbar desktop ready-CoA behavior.
 */

import { Children, isValidElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

const mockStartTour = vi.hoisted(() => vi.fn())

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

describe('AssignedTestsToolbar CoA desktop actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens the ready CoA preview from the desktop trigger path', () => {
        const onPreviewCoA = vi.fn()
        const onPrintCoABody = vi.fn()

        render(
            <AssignedTestsToolbar
                resultsCount={3}
                sampleStatus="completed"
                coaStatus="ready"
                canSubmitForReview={false}
                hasPendingChanges={false}
                hasSignature={true}
                signatureLoading={false}
                isGeneratingCoA={false}
                onPrint={vi.fn()}
                onGenerateCoA={vi.fn()}
                onSubmitForReview={vi.fn()}
                onOpenAssignment={vi.fn()}
                onPreviewCoA={onPreviewCoA}
                onPrintCoABody={onPrintCoABody}
                userRole="manager"
            />,
        )

        const desktopMenu = screen.getByTestId('desktop-dropdown-menu')
        expect(within(desktopMenu).getByTitle('Phiếu kết quả (CoA)')).toBeDefined()
        fireEvent.click(within(desktopMenu).getByRole('button', { name: 'Xem CoA đầy đủ' }))
        fireEvent.click(within(desktopMenu).getByRole('button', { name: 'Chỉ in bảng kết quả' }))

        expect(onPreviewCoA).toHaveBeenCalledTimes(1)
        expect(onPrintCoABody).toHaveBeenCalledTimes(1)
    })
})
