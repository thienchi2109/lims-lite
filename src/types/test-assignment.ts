import type { AssayDefinitionWithMethods, SelectedTest, LabSpecialty } from '@/types'
import type { AccessionMobileWizardProps } from '@/components/accession-mobile-wizard'

export type SortKey = 'name' | 'units'
export type SortConfig = { key: SortKey; direction: 'asc' | 'desc' } | null

export type GridRow =
    | { type: 'group'; key: string; label: string; badgeClass?: string; count: number }
    | { type: 'assay'; key: string; assay: AssayDefinitionWithMethods }

export interface TestAssignmentGridProps {
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    context?: React.ReactNode
    disabledAssayIds?: string[]
    allowedAssayIds?: string[]
    specialties?: LabSpecialty[]
    onSave?: () => void
    isSaving?: boolean
    isSaveDisabled?: boolean
    saveLabel?: string
    summaryInfo?: {
        clientName?: string
        sampleType?: string
        receivedAt?: string
    }
    /** Props for mobile wizard mode — when provided, renders wizard instead of flat layout */
    wizardProps?: Omit<AccessionMobileWizardProps, 
        'searchQuery' | 'setSearchQuery' | 'selectedSpecialtyId' | 'setSelectedSpecialtyId' |
        'specialties' | 'groupedRows' | 'isLoading' | 'disabledSet' | 'specialtiesMap' |
        'selected' | 'onChange' | 'toggleTestSelection' | 'toggleGroupSelection' | 'handleMethodChange' |
        'onSave' | 'isSaving' | 'isSaveDisabled'
    >
}
