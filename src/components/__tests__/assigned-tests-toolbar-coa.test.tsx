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
    DropdownMenuItem: ({ children, onClick, asChild, disabled, className }: any) =>
        asChild ? children : (
            <button data-testid="dropdown-item" onClick={onClick} disabled={disabled} className={className}>
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
                onPrintBarcodeLabel={vi.fn()}
                onGenerateCoA={vi.fn()}
                onSubmitForReview={vi.fn()}
                onOpenAssignment={vi.fn()}
                onPreviewCoA={onPreviewCoA}
                onPrintCoABody={onPrintCoABody}
                userRole="manager"
            />,
        )

        const desktopMenu = screen.getByTestId('desktop-dropdown-menu')
        const coaTrigger = within(desktopMenu).getByTitle('Phiếu kết quả (CoA)')

        expect(coaTrigger).toBeDefined()
        expect(coaTrigger.className).toContain('h-10')
        expect(coaTrigger.className).toContain('w-10')
        expect(coaTrigger.className).toContain('sm:h-8')
        expect(coaTrigger.className).toContain('sm:w-8')

        fireEvent.click(within(desktopMenu).getByRole('button', { name: 'Xem CoA đầy đủ' }))
        fireEvent.click(within(desktopMenu).getByRole('button', { name: 'Chỉ in bảng kết quả' }))

        expect(onPreviewCoA).toHaveBeenCalledTimes(1)
        expect(onPrintCoABody).toHaveBeenCalledTimes(1)
    })

    it('does not show a desktop barcode label print action', () => {
        const onPrintBarcodeLabel = vi.fn()

        render(
            <AssignedTestsToolbar
                resultsCount={3}
                sampleStatus="assigned"
                coaStatus={null}
                canSubmitForReview={false}
                hasPendingChanges={false}
                hasSignature={true}
                signatureLoading={false}
                isGeneratingCoA={false}
                onPrint={vi.fn()}
                onPrintBarcodeLabel={onPrintBarcodeLabel}
                onGenerateCoA={vi.fn()}
                onSubmitForReview={vi.fn()}
                onOpenAssignment={vi.fn()}
                onPreviewCoA={vi.fn()}
                onPrintCoABody={vi.fn()}
                userRole="analyst"
            />,
        )

        expect(screen.queryByRole('button', { name: 'In nhãn barcode' })).toBeNull()
        expect(onPrintBarcodeLabel).not.toHaveBeenCalled()
    })

    it('points analysts to profile signature upload when submit is blocked by missing signature', () => {
        render(
            <AssignedTestsToolbar
                resultsCount={3}
                sampleStatus="in_progress"
                coaStatus={null}
                canSubmitForReview={true}
                hasPendingChanges={false}
                hasSignature={false}
                signatureLoading={false}
                isGeneratingCoA={false}
                onPrint={vi.fn()}
                onPrintBarcodeLabel={vi.fn()}
                onGenerateCoA={vi.fn()}
                onSubmitForReview={vi.fn()}
                onOpenAssignment={vi.fn()}
                onPreviewCoA={vi.fn()}
                onPrintCoABody={vi.fn()}
                userRole="analyst"
            />,
        )

        expect(screen.getByRole('button', { name: 'Gửi duyệt' }).getAttribute('title')).toBe(
            'Vui lòng tải lên chữ ký trong Hồ sơ trước khi nộp',
        )
        expect(screen.getByText('Vui lòng tải lên chữ ký trong Hồ sơ trước khi nộp')).toBeDefined()
    })
})
