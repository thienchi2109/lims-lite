/**
 * Tests for AssignedTestsToolbar desktop ready-CoA behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

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

        expect(screen.getByTitle('Phiếu kết quả (CoA)')).toBeDefined()
        fireEvent.click(screen.getAllByText('Xem CoA đầy đủ')[0])
        fireEvent.click(screen.getAllByText('Chỉ in bảng kết quả')[0])

        expect(onPreviewCoA).toHaveBeenCalledTimes(1)
        expect(onPrintCoABody).toHaveBeenCalledTimes(1)
    })
})
