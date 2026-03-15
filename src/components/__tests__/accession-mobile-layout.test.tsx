/**
 * Tests for AccessionMobileLayout component.
 * Verifies layout orchestration: context collapsible, search/filter,
 * accordion test list delegation, selected summary strip, and bottom bar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { SelectedTest } from '@/types'

// ---------- Mock child component for isolation ----------

vi.mock('@/components/accession-mobile-test-list', () => ({
    AccessionMobileTestList: (props: any) => (
        <div data-testid="test-list" data-search={props.searchQuery}>
            <span data-testid="test-list-count">{props.groupedRows.length}</span>
        </div>
    ),
}))

// Mock Collapsible
vi.mock('@/components/ui/collapsible', () => ({
    Collapsible: ({ children, open, ...props }: any) => (
        <div data-testid="context-collapsible" data-open={String(open)} {...props}>
            {children}
        </div>
    ),
    CollapsibleContent: ({ children }: any) => (
        <div data-testid="context-content">{children}</div>
    ),
    CollapsibleTrigger: ({ children }: any) => (
        <div data-testid="context-trigger">{children}</div>
    ),
}))

// Mock UI primitives
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, disabled, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} data-testid={props['data-testid']}>
            {children}
        </button>
    ),
}))

vi.mock('lucide-react', () => ({
    Search: () => <span data-testid="search-icon" />,
    ChevronDown: () => <span data-testid="chevron-down" />,
    Loader2: () => <span data-testid="loader" />,
    ArrowRight: () => <span data-testid="arrow-right" />,
    X: () => <span data-testid="x-icon" />,
}))

// ---------- Test Data ----------

const mockSpecialties = [
    { id: 'spec-bio', name: 'Sinh hóa', code: 'BIO' },
    { id: 'spec-hem', name: 'Huyết học', code: 'HEM' },
]

const mockGroupedRows = [
    { type: 'group' as const, key: 'group:spec-bio', label: 'Sinh hóa', badgeClass: 'bg-green-50', count: 2 },
    { type: 'assay' as const, key: 'assay-alt', assay: { id: 'assay-alt', name: 'ALT' } },
    { type: 'assay' as const, key: 'assay-ast', assay: { id: 'assay-ast', name: 'AST' } },
]

const mockSelected: SelectedTest[] = [
    { assayId: 'assay-alt', methodId: 'm-1', assayName: 'ALT (GPT)', methodName: 'Sắc ký', units: 'mmol/L' },
    { assayId: 'assay-ast', methodId: 'm-2', assayName: 'AST (GOT)', methodName: 'Đo quang', units: 'U/L' },
    { assayId: 'assay-cbc', methodId: 'm-3', assayName: 'CBC', methodName: 'Tự động', units: null },
]

const specialtiesMap = new Map(mockSpecialties.map((s) => [s.id, s]))

// ---------- Lazy import (after mocks) ----------
import { AccessionMobileLayout } from '../accession-mobile-layout'

// ---------- Tests ----------

describe('AccessionMobileLayout', () => {
    const mockOnChange = vi.fn()
    const mockOnSave = vi.fn()
    const mockSetSearchQuery = vi.fn()
    const mockSetSelectedSpecialtyId = vi.fn()
    const mockSetIsContextOpen = vi.fn()
    const mockToggleTestSelection = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    const defaultProps = {
        context: <div data-testid="mock-context">Context content</div>,
        isContextOpen: true,
        setIsContextOpen: mockSetIsContextOpen,
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectedSpecialtyId: 'all',
        setSelectedSpecialtyId: mockSetSelectedSpecialtyId,
        specialties: mockSpecialties,
        groupedRows: mockGroupedRows,
        isLoading: false,
        disabledSet: new Set<string>(),
        specialtiesMap,
        selected: mockSelected,
        onChange: mockOnChange,
        toggleTestSelection: mockToggleTestSelection,
        onSave: mockOnSave,
        isSaving: false,
    }

    // Test #1: Renders context collapsible + test list
    it('renders context collapsible and test list', () => {
        render(<AccessionMobileLayout {...defaultProps} />)

        expect(screen.getByTestId('context-collapsible')).toBeDefined()
        expect(screen.getByTestId('test-list')).toBeDefined()
        expect(screen.getByTestId('mock-context')).toBeDefined()
    })

    // Test #2: Bottom bar shows selected count
    it('shows selected count in bottom bar', () => {
        render(<AccessionMobileLayout {...defaultProps} />)

        const bottomBar = screen.getByTestId('bottom-bar')
        expect(within(bottomBar).getByText('3')).toBeDefined()
    })

    // Test #3: "Xóa hết" calls onChange([])
    it('calls onChange with empty array when clicking clear all', () => {
        render(<AccessionMobileLayout {...defaultProps} />)

        const clearBtn = screen.getByRole('button', { name: /Xóa hết/i })
        fireEvent.click(clearBtn)

        expect(mockOnChange).toHaveBeenCalledWith([])
    })

    // Test #4: "Tiếp tục" calls onSave
    it('calls onSave when clicking continue button', () => {
        render(<AccessionMobileLayout {...defaultProps} />)

        const saveBtn = screen.getByTestId('save-button')
        fireEvent.click(saveBtn)

        expect(mockOnSave).toHaveBeenCalledOnce()
    })

    // Test #5: Selected summary strip shows chip per test
    it('shows a removable chip for each selected test', () => {
        render(<AccessionMobileLayout {...defaultProps} />)

        const strip = screen.getByTestId('selected-strip')
        expect(within(strip).getByText('ALT (GPT)')).toBeDefined()
        expect(within(strip).getByText('AST (GOT)')).toBeDefined()
        expect(within(strip).getByText('CBC')).toBeDefined()
    })

    // Test #6: Removing chip deselects the test
    it('removes test from selection when tapping chip remove button', () => {
        render(<AccessionMobileLayout {...defaultProps} />)

        // Find the remove button for ALT (GPT)
        const strip = screen.getByTestId('selected-strip')
        const altChip = within(strip).getByText('ALT (GPT)').closest('[data-testid^="chip-"]')!
        const removeBtn = within(altChip as HTMLElement).getByRole('button')
        fireEvent.click(removeBtn)

        // Should call onChange with the remaining 2 tests (excluding ALT)
        expect(mockOnChange).toHaveBeenCalledWith(
            mockSelected.filter((t) => t.assayId !== 'assay-alt'),
        )
    })

    // Test #7: Summary strip hidden when 0 selected
    it('does not render selected strip when no tests are selected', () => {
        render(<AccessionMobileLayout {...defaultProps} selected={[]} />)

        expect(screen.queryByTestId('selected-strip')).toBeNull()
    })
})
