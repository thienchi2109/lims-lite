import React from 'react'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'
import type { AccessionMobileWizardProps } from '@/components/accession-mobile-wizard'
import { AccessionMobileLayout } from '@/components/accession-mobile-layout'
import { AccessionMobileWizard } from '@/components/accession-mobile-wizard'

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
    toggleGroupSelection: (assays: AssayDefinitionWithMethods[]) => void
    handleMethodChange: (assayId: string, methodId: string) => void

    // Save
    onSave: () => void
    isSaving: boolean
    isSaveDisabled?: boolean
    saveLabel: string

    /** When provided, renders wizard instead of flat layout */
    wizardProps?: Omit<AccessionMobileWizardProps,
        'searchQuery' | 'setSearchQuery' | 'selectedSpecialtyId' | 'setSelectedSpecialtyId' |
        'specialties' | 'groupedRows' | 'isLoading' | 'disabledSet' | 'specialtiesMap' |
        'selected' | 'onChange' | 'toggleTestSelection' | 'toggleGroupSelection' | 'handleMethodChange' |
        'onSave' | 'isSaving' | 'isSaveDisabled'
    >
}

/**
 * MobileView
 *
 * Delegates to wizard (when wizardProps provided) or flat AccessionMobileLayout.
 * The thin wrapper preserves the API contract for TestAssignmentGrid.
 */
export function MobileView(props: MobileViewProps) {
    if (props.wizardProps) {
        return (
            <AccessionMobileWizard
                {...props.wizardProps}
                searchQuery={props.searchQuery}
                setSearchQuery={props.setSearchQuery}
                selectedSpecialtyId={props.selectedSpecialtyId}
                setSelectedSpecialtyId={props.setSelectedSpecialtyId}
                specialties={props.specialties}
                groupedRows={props.groupedRows}
                isLoading={props.isLoading}
                disabledSet={props.disabledSet}
                specialtiesMap={props.specialtiesMap}
                selected={props.selected}
                onChange={props.onChange}
                toggleTestSelection={props.toggleTestSelection}
                toggleGroupSelection={props.toggleGroupSelection}
                handleMethodChange={props.handleMethodChange}
                onSave={props.onSave}
                isSaving={props.isSaving}
                isSaveDisabled={props.isSaveDisabled}
            />
        )
    }

    return <AccessionMobileLayout {...props} />
}
