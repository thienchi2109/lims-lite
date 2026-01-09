import { QCFilterControls } from './qc-filter-controls'
import type { SpecialtyWithQC } from './specialty-filter'

// ============================================================================
// TYPES
// ============================================================================

interface QCFilterBarProps {
    specialties: SpecialtyWithQC[]
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * QC Filter Bar - Server Component
 *
 * Integrated filter bar with search, specialty dropdown, and status dropdown.
 * Replaces the previous SpecialtyFilter pill-based component.
 *
 * All filtering is server-side via URL params.
 */
export function QCFilterBar({ specialties }: QCFilterBarProps) {
    // Transform to format expected by client component
    const specialtyOptions = specialties.map((s) => ({
        id: s.id,
        name: s.name,
        count: s.qc_count,
    }))

    return (
        <nav aria-label="Bộ lọc QC" className="mb-4">
            <QCFilterControls specialties={specialtyOptions} />
        </nav>
    )
}
