import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useMediaQueryMock = vi.fn()
const useTestAssignmentGridMock = vi.fn()
const toggleGroupSelectionMock = vi.fn()

vi.mock('@/hooks/use-media-query', () => ({
    useMediaQuery: (...args: unknown[]) => useMediaQueryMock(...args),
}))

vi.mock('@/hooks/use-test-assignment-grid', () => ({
    useTestAssignmentGrid: (...args: unknown[]) => useTestAssignmentGridMock(...args),
}))

vi.mock('@/components/accession-mobile-test-list', () => ({
    AccessionMobileTestList: () => <div data-testid="test-list" />,
}))

vi.mock('@/components/accession-mobile-layout', () => ({
    AccessionMobileLayout: ({
        toggleGroupSelection,
    }: {
        toggleGroupSelection: (assays: []) => void
    }) => (
        <button type="button" onClick={() => toggleGroupSelection([])}>
            Chọn nhóm mobile
        </button>
    ),
}))

vi.mock('@/components/accession-mobile-wizard', () => ({
    AccessionMobileWizard: ({
        isSaveDisabled,
        toggleGroupSelection,
    }: {
        isSaveDisabled?: boolean
        toggleGroupSelection: (assays: []) => void
    }) => (
        <div>
            <button
                type="button"
                data-testid="wizard-save-button"
                disabled={isSaveDisabled}
            >
                Lưu wizard
            </button>
            <button type="button" onClick={() => toggleGroupSelection([])}>
                Chọn nhóm wizard
            </button>
        </div>
    ),
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
    DesktopGrid: ({
        toggleGroupSelection,
    }: {
        toggleGroupSelection: (assays: []) => void
    }) => (
        <button type="button" onClick={() => toggleGroupSelection([])}>
            Chọn nhóm desktop
        </button>
    ),
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
            toggleGroupSelection: toggleGroupSelectionMock,
            handleMethodChange: vi.fn(),
            selectedMethodId: 'all',
            setSelectedMethodId: vi.fn(),
            methods: [],
            processedAssays: [],
            handleRemove: vi.fn(),
        })
    })

    it('passes group selection into the desktop catalog path', () => {
        useMediaQueryMock.mockReturnValue(true)
        render(<TestAssignmentGrid selected={[]} onChange={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Chọn nhóm desktop' }))

        expect(toggleGroupSelectionMock).toHaveBeenCalledOnce()
    })

    it('passes group selection into the flat mobile path', () => {
        render(<TestAssignmentGrid selected={[]} onChange={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Chọn nhóm mobile' }))

        expect(toggleGroupSelectionMock).toHaveBeenCalledOnce()
    })

    it('passes isSaveDisabled into the mobile wizard path', () => {
        render(
            <TestAssignmentGrid
                selected={[]}
                onChange={vi.fn()}
                isSaveDisabled={true}
                onSave={vi.fn()}
                wizardProps={{
                    selectedClient: null,
                    onSelectClient: vi.fn(),
                    showClientForm: false,
                    onOpenFormChange: vi.fn(),
                    clientFormData: undefined,
                    onFormDataChange: vi.fn(),
                    showQRScanner: false,
                    onShowQRScanner: vi.fn(),
                    onQRScan: vi.fn(),
                    selectedSampleType: 'Máu',
                    onSampleTypeChange: vi.fn(),
                    receivedAtRegister: {
                        name: 'received_at',
                        onChange: vi.fn(),
                        onBlur: vi.fn(),
                        ref: vi.fn(),
                    },
                    receivedAtValue: '',
                    submitError: null,
                    submitSuccess: null,
                    onReset: vi.fn(),
                }}
            />,
        )

        expect((screen.getByTestId('wizard-save-button') as HTMLButtonElement).disabled).toBe(true)
        fireEvent.click(screen.getByRole('button', { name: 'Chọn nhóm wizard' }))
        expect(toggleGroupSelectionMock).toHaveBeenCalledOnce()
    })
})
