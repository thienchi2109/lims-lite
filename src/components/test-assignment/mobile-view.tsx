import React from 'react'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'
import { AccessionMobileLayout } from '@/components/accession-mobile-layout'

interface MobileViewProps {
    // Context
    context?: React.ReactNode
    isContextOpen: boolean
    setIsContextOpen: (open: boolean) => void

    // Search & Filters
    searchQuery: string
    setSearchQuery: (query: string) => void
    selectedSpecialtyId: string
    setSelectedSpecialtyId: (id: string) => void
    specialties: Array<{ id: string; name: string; code: string }>

    // Data
    groupedRows: GridRow[]
    isLoading: boolean
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>

    // Selection
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    handleMethodChange: (assayId: string, methodId: string) => void

    // Save
    onSave: () => void
    isSaving: boolean
    saveLabel: string
}

/**
 * MobileView
 *
 * Delegates to AccessionMobileLayout which renders accordion-based
 * specialty groups with a selected tests summary strip.
 * This thin wrapper preserves the existing API contract for TestAssignmentGrid.
 */
export function MobileView(props: MobileViewProps) {
    return <AccessionMobileLayout {...props} />
}
