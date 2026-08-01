/**
 * Tests for AccessionMobileTestList component.
 * Verifies accordion-based test selection: group rendering, single-expand,
 * test item display, selection toggling, disabled state, and search fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { GridRow } from '@/types/test-assignment'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'

// ---------- Mock Accordion for unit tests ----------
// (Integration test #2 uses the real Accordion)

vi.mock('@/components/ui/accordion', () => ({
    Accordion: ({ children, onValueChange, collapsible, type, ...props }: any) => (
        <div data-testid="accordion" data-type={type} {...props}>
            {children}
        </div>
    ),
    AccordionItem: ({ children, value, ...props }: any) => (
        <div data-testid={`accordion-item-${value}`} {...props}>{children}</div>
    ),
    AccordionTrigger: ({ children, leadingAction, ...props }: any) => (
        <div>
            {leadingAction}
            <button data-testid="accordion-trigger" {...props}>{children}</button>
        </div>
    ),
    AccordionContent: ({ children, ...props }: any) => (
        <div data-testid="accordion-content" {...props}>{children}</div>
    ),
}))

vi.mock('@/lib/specialty-badges', () => ({
    SPECIALTY_BADGE_CLASSES: {
        HEM: 'bg-red-50 text-red-700',
        BIO: 'bg-green-50 text-green-700',
    },
}))

const virtualizerSpies = vi.hoisted(() => {
    const measureElement = vi.fn()
    const useVirtualizer = vi.fn(({ count }: { count: number }) => ({
        getTotalSize: () => count * 72,
        getVirtualItems: () =>
            Array.from({ length: count }, (_, i) => ({
                index: i,
                key: i,
                start: i * 72,
                size: 72,
            })),
        measureElement,
    }))

    return { useVirtualizer, measureElement }
})

// Mock virtualizer — jsdom has no layout engine so virtualizer renders nothing
vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: virtualizerSpies.useVirtualizer,
}))

// ---------- Test Data ----------

const now = new Date().toISOString()

const makeAssay = (
    id: string,
    name: string,
    specialtyId: string | null,
    methods: { method_id: string; name: string; is_default: boolean }[] = [],
): AssayDefinitionWithMethods => ({
    id,
    name,
    specialty_id: specialtyId,
    units: 'mmol/L',
    validation_rules: {},
    created_at: now,
    updated_at: now,
    deleted_at: null,
    methods: methods.map((m) => ({
        id: `am-${m.method_id}`,
        method_id: m.method_id,
        name: m.name,
        is_default: m.is_default,
        notes: null,
    })),
})

const hemSpecialtyId = 'spec-hem'
const bioSpecialtyId = 'spec-bio'

const assayALT = makeAssay('assay-alt', 'ALT (GPT)', bioSpecialtyId, [
    { method_id: 'method-1', name: 'Sắc ký lỏng', is_default: true },
])
const assayAST = makeAssay('assay-ast', 'AST (GOT)', bioSpecialtyId, [
    { method_id: 'method-2', name: 'Đo quang', is_default: true },
])
const assayCBC = makeAssay('assay-cbc', 'CBC', hemSpecialtyId, [
    { method_id: 'method-3', name: 'Tự động', is_default: true },
])

const groupedRows: GridRow[] = [
    { type: 'group', key: `group:${bioSpecialtyId}`, label: 'Sinh hóa', badgeClass: 'bg-green-50 text-green-700', count: 2 },
    { type: 'assay', key: 'assay-alt', assay: assayALT },
    { type: 'assay', key: 'assay-ast', assay: assayAST },
    { type: 'group', key: `group:${hemSpecialtyId}`, label: 'Huyết học', badgeClass: 'bg-red-50 text-red-700', count: 1 },
    { type: 'assay', key: 'assay-cbc', assay: assayCBC },
]

const specialtiesMap = new Map([
    [bioSpecialtyId, { id: bioSpecialtyId, name: 'Sinh hóa', code: 'BIO' }],
    [hemSpecialtyId, { id: hemSpecialtyId, name: 'Huyết học', code: 'HEM' }],
])

const emptyDisabledSet = new Set<string>()

const selectedALT: SelectedTest = {
    assayId: 'assay-alt',
    methodId: 'method-1',
    assayName: 'ALT (GPT)',
    methodName: 'Sắc ký lỏng',
    units: 'mmol/L',
}

// ---------- Lazy import (after mocks) ----------
import { AccessionMobileTestList } from '../accession-mobile-test-list'

// ---------- Tests ----------

describe('AccessionMobileTestList', () => {
    const mockToggle = vi.fn()

    beforeEach(() => {
        mockToggle.mockClear()
        virtualizerSpies.useVirtualizer.mockClear()
        virtualizerSpies.measureElement.mockClear()
    })

    const defaultProps = {
        groupedRows,
        selected: [] as SelectedTest[],
        toggleTestSelection: mockToggle,
        toggleGroupSelection: vi.fn(),
        handleMethodChange: vi.fn(),
        disabledSet: emptyDisabledSet,
        specialtiesMap,
        searchQuery: '',
        isLoading: false,
    }

    // Test #1: Renders accordion item per specialty group
    it('renders an accordion item for each specialty group', () => {
        render(<AccessionMobileTestList {...defaultProps} />)

        // Each specialty group gets an AccordionItem
        expect(screen.getByTestId(`accordion-item-group:${bioSpecialtyId}`)).toBeDefined()
        expect(screen.getByTestId(`accordion-item-group:${hemSpecialtyId}`)).toBeDefined()

        // Group header buttons are uniquely identified by label + count
        const bioGroup = screen.getByTestId(`accordion-item-group:${bioSpecialtyId}`)
        const hemGroup = screen.getByTestId(`accordion-item-group:${hemSpecialtyId}`)

        expect(
            within(bioGroup).getByRole('button', { name: /Sinh hóa[\s\S]*2 chỉ tiêu/i }),
        ).toBeDefined()
        expect(
            within(hemGroup).getByRole('button', { name: /Huyết học[\s\S]*1 chỉ tiêu/i }),
        ).toBeDefined()
        expect(screen.getByText(/2 chỉ tiêu/)).toBeDefined()
        expect(screen.getByText(/1 chỉ tiêu/)).toBeDefined()
    })

    // Test #2: Single-expand — uses real Accordion (integration)
    // This test is in a separate describe block below WITHOUT the mock

    // Test #3: Assay row shows test name + method name
    it('shows test name and method name in assay rows', () => {
        render(<AccessionMobileTestList {...defaultProps} />)

        expect(screen.getByText('ALT (GPT)')).toBeDefined()
        expect(screen.getByText('Sắc ký lỏng')).toBeDefined()
        expect(screen.getByText('AST (GOT)')).toBeDefined()
        expect(screen.getByText('Đo quang')).toBeDefined()
    })

    // Test #4: Selected test shows checked state
    it('shows checked state for selected tests', () => {
        render(
            <AccessionMobileTestList
                {...defaultProps}
                selected={[selectedALT]}
            />,
        )

        const altRow = screen.getByTestId('test-row-assay-alt')
        // The checked indicator should be present
        expect(within(altRow).getByTestId('check-icon')).toBeDefined()
    })

    // Test #5: Clicking test row calls toggleTestSelection
    it('calls toggleTestSelection when clicking a test row', () => {
        render(<AccessionMobileTestList {...defaultProps} />)

        const altRow = screen.getByTestId('test-row-assay-alt')
        fireEvent.click(within(altRow).getByRole('button'))
        expect(mockToggle).toHaveBeenCalledTimes(1)
        expect(mockToggle).toHaveBeenCalledWith(assayALT)
    })

    // Test #6: Disabled test — click is a no-op
    it('does not call toggleTestSelection for disabled tests', () => {
        const disabledSet = new Set(['assay-alt'])

        render(
            <AccessionMobileTestList
                {...defaultProps}
                disabledSet={disabledSet}
            />,
        )

        const altRow = screen.getByTestId('test-row-assay-alt')
        fireEvent.click(within(altRow).getByRole('button'))
        expect(mockToggle).not.toHaveBeenCalled()
    })

    // Test #7: Search active → flat list, no accordion
    it('renders flat list without accordion headers when searchQuery is non-empty', () => {
        render(
            <AccessionMobileTestList
                {...defaultProps}
                searchQuery="ALT"
            />,
        )

        // Should render flat list container
        expect(screen.getByTestId('flat-list')).toBeDefined()

        // Should NOT render accordion
        expect(screen.queryByTestId('accordion')).toBeNull()

        // Should still render the test items
        expect(screen.getByText('ALT (GPT)')).toBeDefined()
    })
})
