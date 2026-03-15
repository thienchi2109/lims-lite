/**
 * Tests for TestCatalogAccordion shared component.
 * Validates accordion rendering in both mobile and desktop variants,
 * test selection behavior, group headers, and search-mode flat list fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { GridRow } from '@/types/test-assignment'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'

// ---------- Mock Accordion for unit tests ----------

const accordionSpies = vi.hoisted(() => ({
    accordionProps: vi.fn(),
}))

vi.mock('@/components/ui/accordion', () => ({
    Accordion: ({ children, type, ...props }: any) => {
        accordionSpies.accordionProps({ type, ...props })
        return (
            <div data-testid="accordion" data-type={type} {...props}>
                {children}
            </div>
        )
    },
    AccordionItem: ({ children, value, ...props }: any) => (
        <div data-testid={`accordion-item-${value}`} {...props}>{children}</div>
    ),
    AccordionTrigger: ({ children, ...props }: any) => (
        <button data-testid="accordion-trigger" {...props}>{children}</button>
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
    units = 'mmol/L',
): AssayDefinitionWithMethods => ({
    id,
    name,
    specialty_id: specialtyId,
    units,
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
], 'g/dL')

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

// ---------- Lazy import ----------
import { TestCatalogAccordion } from '../test-assignment/test-catalog-accordion'

// ---------- Tests ----------

describe('TestCatalogAccordion', () => {
    const mockToggle = vi.fn()
    const mockMethodChange = vi.fn()

    beforeEach(() => {
        mockToggle.mockClear()
        mockMethodChange.mockClear()
        accordionSpies.accordionProps.mockClear()
        virtualizerSpies.useVirtualizer.mockClear()
        virtualizerSpies.measureElement.mockClear()
    })

    const baseProps = {
        groupedRows,
        selected: [] as SelectedTest[],
        toggleTestSelection: mockToggle,
        handleMethodChange: mockMethodChange,
        disabledSet: emptyDisabledSet,
        specialtiesMap,
        searchQuery: '',
        isLoading: false,
    }

    // Test #1: Desktop variant uses type="multiple"
    it('renders type="multiple" accordion for desktop variant', () => {
        render(<TestCatalogAccordion {...baseProps} variant="desktop" />)
        const accordion = screen.getByTestId('accordion')
        expect(accordion.getAttribute('data-type')).toBe('multiple')
    })

    it('does not expand all desktop groups by default', () => {
        render(<TestCatalogAccordion {...baseProps} variant="desktop" />)

        const lastAccordionProps = accordionSpies.accordionProps.mock.calls.at(-1)?.[0]
        const groupCount = groupedRows.filter((row) => row.type === 'group').length
        const defaultOpenCount = Array.isArray(lastAccordionProps?.defaultValue)
            ? lastAccordionProps.defaultValue.length
            : 0

        expect(defaultOpenCount).toBeLessThan(groupCount)
    })

    // Test #2: Mobile variant uses type="single"
    it('renders type="single" accordion for mobile variant', () => {
        render(<TestCatalogAccordion {...baseProps} variant="mobile" />)
        const accordion = screen.getByTestId('accordion')
        expect(accordion.getAttribute('data-type')).toBe('single')
    })

    // Test #3: Group headers render badge + label + count
    it('renders group headers with badge, label, and count', () => {
        render(<TestCatalogAccordion {...baseProps} variant="desktop" />)

        const bioGroup = screen.getByTestId(`accordion-item-group:${bioSpecialtyId}`)
        const hemGroup = screen.getByTestId(`accordion-item-group:${hemSpecialtyId}`)

        expect(
            within(bioGroup).getByRole('button', { name: /Sinh hóa[\s\S]*2 chỉ tiêu/i }),
        ).toBeDefined()
        expect(
            within(hemGroup).getByRole('button', { name: /Huyết học[\s\S]*1 chỉ tiêu/i }),
        ).toBeDefined()
    })

    // Test #4: Desktop assay row shows test name + method + units
    it('shows test name, method, and units in desktop assay rows', () => {
        render(<TestCatalogAccordion {...baseProps} variant="desktop" />)

        expect(screen.getByText('ALT (GPT)')).toBeDefined()
        expect(screen.getByText('Sắc ký lỏng')).toBeDefined()
        // CBC has units g/dL
        expect(screen.getByText('CBC')).toBeDefined()
        expect(screen.getByText('g/dL')).toBeDefined()
    })

    // Test #5: Selected test shows check icon
    it('shows check icon for selected tests', () => {
        render(
            <TestCatalogAccordion
                {...baseProps}
                variant="desktop"
                selected={[selectedALT]}
            />,
        )

        const altRow = screen.getByTestId('test-row-assay-alt')
        expect(within(altRow).getByTestId('check-icon')).toBeDefined()
    })

    // Test #6: Click assay row → toggleTestSelection called
    it('calls toggleTestSelection when clicking a test row', () => {
        render(<TestCatalogAccordion {...baseProps} variant="desktop" />)

        const altRow = screen.getByTestId('test-row-assay-alt')
        fireEvent.click(within(altRow).getByRole('button'))
        expect(mockToggle).toHaveBeenCalledTimes(1)
        expect(mockToggle).toHaveBeenCalledWith(assayALT)
    })

    // Test #7: Disabled assay row → click no-op
    it('does not call toggleTestSelection for disabled tests', () => {
        const disabledSet = new Set(['assay-alt'])

        render(
            <TestCatalogAccordion
                {...baseProps}
                variant="desktop"
                disabledSet={disabledSet}
            />,
        )

        const altRow = screen.getByTestId('test-row-assay-alt')
        fireEvent.click(within(altRow).getByRole('button'))
        expect(mockToggle).not.toHaveBeenCalled()
    })

    // Test #8: Search active → flat list, no accordion
    it('renders flat list without accordion when searchQuery is non-empty', () => {
        render(
            <TestCatalogAccordion
                {...baseProps}
                variant="desktop"
                searchQuery="ALT"
            />,
        )

        expect(screen.getByTestId('flat-list')).toBeDefined()
        expect(screen.queryByTestId('accordion')).toBeNull()
        expect(screen.getByText('ALT (GPT)')).toBeDefined()
    })

    it('shows specialty badges in desktop search flat list', () => {
        render(
            <TestCatalogAccordion
                {...baseProps}
                variant="desktop"
                searchQuery="ALT"
            />,
        )

        expect(
            within(screen.getByTestId('test-row-assay-alt')).getByText('Sinh hóa'),
        ).toBeDefined()
        expect(
            within(screen.getByTestId('test-row-assay-cbc')).getByText('Huyết học'),
        ).toBeDefined()
    })

    it('measures search rows for variable-height virtualization', () => {
        render(
            <TestCatalogAccordion
                {...baseProps}
                variant="desktop"
                searchQuery="ALT"
            />,
        )

        expect(screen.getByTestId('flat-list')).toBeDefined()
        expect(virtualizerSpies.measureElement).toHaveBeenCalled()
    })
})
