import type { AssayDefinitionWithMethods, SelectedTest, LabSpecialty } from '@/types'

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
    specialties?: LabSpecialty[]
    onSave?: () => void
    isSaving?: boolean
    saveLabel?: string
    summaryInfo?: {
        clientName?: string
        sampleType?: string
        receivedAt?: string
    }
}
