'use client'

/**
 * AccessionMobileTestList
 *
 * Thin wrapper around TestCatalogAccordion for mobile view.
 * Delegates all rendering to the shared component with variant="mobile".
 */

import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'
import { TestCatalogAccordion } from './test-assignment/test-catalog-accordion'

interface AccessionMobileTestListProps {
    groupedRows: GridRow[]
    selected: SelectedTest[]
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    toggleGroupSelection: (assays: AssayDefinitionWithMethods[]) => void
    handleMethodChange: (assayId: string, methodId: string) => void
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>
    searchQuery: string
    isLoading: boolean
}

export function AccessionMobileTestList(props: AccessionMobileTestListProps) {
    return <TestCatalogAccordion {...props} variant="mobile" />
}
