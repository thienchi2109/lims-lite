/**
 * Regression coverage for bulk assay selection by technical group.
 * Uses the real shared Accordion and Checkbox components to lock DOM semantics.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'
import { TestCatalogAccordion } from '../test-assignment/test-catalog-accordion'

vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: ({ count }: { count: number }) => ({
        getTotalSize: () => count * 72,
        getVirtualItems: () =>
            Array.from({ length: count }, (_, index) => ({
                index,
                key: index,
                start: index * 72,
                size: 72,
            })),
        measureElement: vi.fn(),
    }),
}))

const now = '2026-08-01T00:00:00.000Z'

function makeAssay(id: string, name: string, specialtyId: string | null): AssayDefinitionWithMethods {
    return {
        id,
        name,
        specialty_id: specialtyId,
        units: null,
        validation_rules: {},
        created_at: now,
        updated_at: now,
        deleted_at: null,
        methods: [],
    }
}

function makeSelected(assay: AssayDefinitionWithMethods): SelectedTest {
    return {
        assayId: assay.id,
        methodId: null,
        assayName: assay.name,
        methodName: 'Không có',
        units: assay.units,
    }
}

const cbc = makeAssay('cbc', 'Công thức máu', 'hematology')
const esr = makeAssay('esr', 'Máu lắng', 'hematology')
const smear = makeAssay('smear', 'Phết máu ngoại biên', 'hematology')
const ungrouped = makeAssay('ungrouped', 'Chỉ tiêu khác', null)
const disabledOnly = makeAssay('disabled-only', 'Kháng thể', 'immunology')

const groupedRows: GridRow[] = [
    {
        type: 'group',
        key: 'group:hematology',
        label: 'Huyết học',
        badgeClass: 'bg-red-50 text-red-700',
        count: 3,
    },
    { type: 'assay', key: cbc.id, assay: cbc },
    { type: 'assay', key: esr.id, assay: esr },
    { type: 'assay', key: smear.id, assay: smear },
    {
        type: 'group',
        key: 'group:ungrouped',
        label: 'Chưa phân nhóm',
        count: 1,
    },
    { type: 'assay', key: ungrouped.id, assay: ungrouped },
    {
        type: 'group',
        key: 'group:immunology',
        label: 'Miễn dịch',
        count: 1,
    },
    { type: 'assay', key: disabledOnly.id, assay: disabledOnly },
]

const toggleGroupSelection = vi.fn()

const baseProps = {
    groupedRows,
    selected: [makeSelected(cbc), makeSelected(smear)],
    toggleTestSelection: vi.fn(),
    toggleGroupSelection,
    handleMethodChange: vi.fn(),
    disabledSet: new Set([smear.id, disabledOnly.id]),
    specialtiesMap: new Map(),
    searchQuery: '',
    isLoading: false,
}

describe('TestCatalogAccordion group selection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders a partial desktop group with a minus icon and calls the atomic group callback', () => {
        render(<TestCatalogAccordion {...baseProps} variant="desktop" />)

        const checkbox = screen.getByRole('checkbox', { name: 'Chọn nhóm Huyết học' })
        const trigger = screen.getByRole('button', { name: /Huyết học[\s\S]*3 chỉ tiêu/i })
        const heading = trigger.closest('h3')

        expect(checkbox.getAttribute('data-state')).toBe('indeterminate')
        expect(checkbox.querySelector('.lucide-minus')).not.toBeNull()
        expect(checkbox.querySelector('.lucide-check')).toBeNull()
        expect(checkbox.closest('[data-slot="accordion-trigger"]')).toBeNull()
        expect(trigger.contains(checkbox)).toBe(false)
        expect(heading).not.toBeNull()
        expect(heading?.contains(checkbox)).toBe(false)
        expect(heading?.querySelectorAll('button')).toHaveLength(1)
        expect(heading?.querySelector('button')).toBe(trigger)

        fireEvent.click(checkbox)

        expect(toggleGroupSelection).toHaveBeenCalledOnce()
        expect(toggleGroupSelection).toHaveBeenCalledWith([cbc, esr, smear])
    })

    it('supports group selection in the mobile variant including Chưa phân nhóm', () => {
        render(<TestCatalogAccordion {...baseProps} variant="mobile" />)

        const checkbox = screen.getByRole('checkbox', { name: 'Chọn nhóm Chưa phân nhóm' })
        expect(checkbox.getAttribute('data-state')).toBe('unchecked')

        fireEvent.click(checkbox)

        expect(toggleGroupSelection).toHaveBeenCalledWith([ungrouped])
    })

    it('does not expand or collapse a group when clicking its sibling checkbox', () => {
        render(<TestCatalogAccordion {...baseProps} variant="mobile" />)

        const checkbox = screen.getByRole('checkbox', { name: 'Chọn nhóm Huyết học' })
        const trigger = screen.getByRole('button', { name: /Huyết học[\s\S]*3 chỉ tiêu/i })
        const accordionItem = trigger.closest('[data-slot="accordion-item"]')

        expect(accordionItem?.getAttribute('data-state')).toBe('closed')
        fireEvent.click(trigger)
        expect(accordionItem?.getAttribute('data-state')).toBe('open')

        fireEvent.click(checkbox)

        expect(accordionItem?.getAttribute('data-state')).toBe('open')
        expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })

    it('renders a fully selected group with a check icon', () => {
        render(
            <TestCatalogAccordion
                {...baseProps}
                selected={[makeSelected(cbc), makeSelected(esr)]}
                variant="desktop"
            />,
        )

        const checkbox = screen.getByRole('checkbox', { name: 'Chọn nhóm Huyết học' })
        expect(checkbox.getAttribute('data-state')).toBe('checked')
        expect(checkbox.querySelector('.lucide-check')).not.toBeNull()
        expect(checkbox.querySelector('.lucide-minus')).toBeNull()
    })

    it('disables an unchecked group when every displayed assay is disabled', () => {
        render(<TestCatalogAccordion {...baseProps} variant="desktop" />)

        const checkbox = screen.getByRole('checkbox', { name: 'Chọn nhóm Miễn dịch' })
        expect(checkbox.getAttribute('data-state')).toBe('unchecked')
        expect((checkbox as HTMLButtonElement).disabled).toBe(true)
    })

    it('keeps search mode as a flat list without group checkboxes', () => {
        render(
            <TestCatalogAccordion
                {...baseProps}
                searchQuery="máu"
                variant="desktop"
            />,
        )

        expect(screen.getByTestId('flat-list')).toBeDefined()
        expect(screen.queryByRole('checkbox', { name: /Chọn nhóm/i })).toBeNull()
    })
})
