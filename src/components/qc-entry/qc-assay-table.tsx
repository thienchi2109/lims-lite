import { QCTableRow, type AssayWithQC } from './qc-table-row'
import type { MiniChartDataPoint } from './qc-sparkline'

// ============================================================================
// TYPES
// ============================================================================

interface QCAssayTableProps {
  assays: AssayWithQC[]
  selectedId: string | null
  qcResultsByDefinition: Record<string, MiniChartDataPoint[]>
  activeSpecialty?: string | null
}

// ============================================================================
// HELPER - Group assays by name (L1/L2 together)
// ============================================================================

function groupAssaysByName(assays: AssayWithQC[]): AssayWithQC[] {
  // Sort by name first, then by level (L1 before L2)
  return [...assays].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name)
    if (nameCompare !== 0) return nameCompare
    return a.level.localeCompare(b.level)
  })
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCAssayTable({
  assays,
  selectedId,
  qcResultsByDefinition,
  activeSpecialty,
}: QCAssayTableProps) {
  // Empty state
  if (assays.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Không có xét nghiệm QC
      </div>
    )
  }

  // Group and sort assays so L1/L2 are adjacent
  const groupedAssays = groupAssaysByName(assays)

  return (
    <div className="flex flex-col" role="table" aria-label="Bảng xét nghiệm QC">
      {/* Header row */}
      <div className="grid grid-cols-[minmax(220px,1fr)_80px_110px_180px] items-center gap-4 px-4 py-2 border-b bg-muted/50 text-sm font-medium text-muted-foreground" role="row">
        <span role="columnheader">Xét nghiệm</span>
        <span className="text-center" role="columnheader">Mức</span>
        <span className="text-center" role="columnheader">Trạng thái</span>
        <span className="text-right" role="columnheader">Xu hướng</span>
      </div>

      {/* Data rows */}
      {groupedAssays.map((assay) => (
        <QCTableRow
          key={assay.id}
          assay={assay}
          isSelected={assay.id === selectedId}
          qcDataPoints={qcResultsByDefinition[assay.id] || []}
          activeSpecialty={activeSpecialty}
        />
      ))}
    </div>
  )
}
