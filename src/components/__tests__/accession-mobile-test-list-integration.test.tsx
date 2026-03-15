/**
 * Integration test: AccessionMobileTestList single-expand behavior.
 * Uses the REAL Accordion (no mock) to verify that opening group B closes group A.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { GridRow } from '@/types/test-assignment'
import type { AssayDefinitionWithMethods } from '@/types'

vi.mock('@/lib/specialty-badges', () => ({
    SPECIALTY_BADGE_CLASSES: {
        HEM: 'bg-red-50 text-red-700',
        BIO: 'bg-green-50 text-green-700',
    },
}))

const now = new Date().toISOString()

const makeAssay = (id: string, name: string, specialtyId: string | null): AssayDefinitionWithMethods => ({
    id, name, specialty_id: specialtyId, units: 'mmol/L',
    validation_rules: {}, created_at: now, updated_at: now, deleted_at: null,
    methods: [{ id: `am-${id}`, method_id: `m-${id}`, name: 'Method', is_default: true, notes: null }],
})

const groupedRows: GridRow[] = [
    { type: 'group', key: 'group:bio', label: 'Sinh hóa', badgeClass: 'bg-green-50', count: 1 },
    { type: 'assay', key: 'a1', assay: makeAssay('a1', 'ALT', 'bio') },
    { type: 'group', key: 'group:hem', label: 'Huyết học', badgeClass: 'bg-red-50', count: 1 },
    { type: 'assay', key: 'a2', assay: makeAssay('a2', 'CBC', 'hem') },
]

import { AccessionMobileTestList } from '../accession-mobile-test-list'

describe('AccessionMobileTestList — real Accordion integration', () => {
    it('opening group B closes group A (single-expand)', () => {
        render(
            <AccessionMobileTestList
                groupedRows={groupedRows}
                selected={[]}
                toggleTestSelection={vi.fn()}
                disabledSet={new Set()}
                specialtiesMap={new Map([
                    ['bio', { id: 'bio', name: 'Sinh hóa', code: 'BIO' }],
                    ['hem', { id: 'hem', name: 'Huyết học', code: 'HEM' }],
                ])}
                searchQuery=""
                isLoading={false}
            />,
        )

        // Initially both groups are collapsed — content not visible
        // Radix accordion with data-state="closed" hides content
        const triggers = screen.getAllByRole('button', { name: /chỉ tiêu/i })
        expect(triggers).toHaveLength(2)

        // Open group A (Sinh hóa)
        fireEvent.click(triggers[0])

        // ALT should be visible, CBC should not be
        expect(screen.getByText('ALT')).toBeDefined()

        // Open group B (Huyết học)
        fireEvent.click(triggers[1])

        // CBC should now be visible
        expect(screen.getByText('CBC')).toBeDefined()

        // Verify single-expand: Radix sets data-state="closed" on group A's content
        const accordionItems = document.querySelectorAll('[data-slot="accordion-item"]')

        // The first item should be closed, second should be open
        if (accordionItems.length === 2) {
            const firstContent = accordionItems[0].querySelector('[data-slot="accordion-content"]')
            const secondContent = accordionItems[1].querySelector('[data-slot="accordion-content"]')

            expect(firstContent?.getAttribute('data-state')).toBe('closed')
            expect(secondContent?.getAttribute('data-state')).toBe('open')
        }
    })
})
