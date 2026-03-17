import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useMediaQueryMock = vi.fn()
const useTestAssignmentGridMock = vi.fn()

vi.mock('@/hooks/use-media-query', () => ({
    useMediaQuery: (...args: unknown[]) => useMediaQueryMock(...args),
}))

vi.mock('@/hooks/use-test-assignment-grid', () => ({
    useTestAssignmentGrid: (...args: unknown[]) => useTestAssignmentGridMock(...args),
}))

vi.mock('@/components/accession-mobile-test-list', () => ({
    AccessionMobileTestList: () => <div data-testid="test-list" />,
}))

vi.mock('@/components/ui/collapsible', () => ({
    Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
    Button: ({
        children,
        disabled,
        onClick,
        type,
        ...props
    }: {
        children: React.ReactNode
        disabled?: boolean
        onClick?: () => void
        type?: 'button' | 'submit' | 'reset'
        [key: string]: unknown
    }) => (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            data-testid={typeof props['data-testid'] === 'string' ? props['data-testid'] : undefined}
        >
            {children}
        </button>
    ),
}))

vi.mock('@/components/test-assignment/desktop-grid', () => ({
    DesktopGrid: () => null,
}))

vi.mock('@/components/test-assignment/selection-panel', () => ({
    SelectionPanel: () => null,
}))

vi.mock('@/components/ui/resizable', () => ({
    ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ResizableHandle: () => null,
}))

vi.mock('lucide-react', () => ({
    Search: () => <span />,
    ChevronDown: () => <span />,
    Loader2: () => <span />,
    ArrowRight: () => <span />,
    X: () => <span />,
    CheckCircle2: () => <span />,
    FlaskConical: () => <span />,
}))

import { TestAssignmentGrid } from '../test-assignment-grid'

describe('TestAssignmentGrid', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useMediaQueryMock.mockReturnValue(false)
        useTestAssignmentGridMock.mockReturnValue({
            searchQuery: '',
            setSearchQuery: vi.fn(),
            selectedSpecialtyId: 'all',
            setSelectedSpecialtyId: vi.fn(),
            groupedRows: [],
            isLoading: false,
            disabledSet: new Set<string>(),
            specialtiesMap: new Map(),
            toggleTestSelection: vi.fn(),
            handleMethodChange: vi.fn(),
            selectedMethodId: 'all',
            setSelectedMethodId: vi.fn(),
            methods: [],
            processedAssays: [],
            handleRemove: vi.fn(),
        })
    })

    it('disables the mobile save button when isSaveDisabled is true', () => {
        render(
            <TestAssignmentGrid
                selected={[]}
                onChange={vi.fn()}
                isSaveDisabled={true}
                onSave={vi.fn()}
            />,
        )

        expect((screen.getByTestId('save-button') as HTMLButtonElement).disabled).toBe(true)
    })
})
