'use client'

import { DataTablePagination } from '@/components/ui/data-table-pagination'
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
  page: number
  pageSize: number
  totalCount: number
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
  page,
  pageSize,
  totalCount,
}: QCAssayTableProps) {
  // Empty state
  if (assays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <span>Không tìm thấy xét nghiệm phù hợp</span>
        <span className="text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</span>
      </div>
    )
  }

  // Group and sort assays so L1/L2 are adjacent
  const groupedAssays = groupAssaysByName(assays)

  return (
    <div className="flex flex-col gap-4">
      {/* Table */}
      <div className="flex flex-col" role="table" aria-label="Bảng xét nghiệm QC">
        {/* Header row */}
        <div className="grid grid-cols-[minmax(200px,3fr)_80px_120px_minmax(150px,2fr)] items-center gap-4 px-4 py-2 border-b bg-muted/50 text-sm font-medium text-muted-foreground" role="row">
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
            page={page}
          />
        ))}
      </div>

      {/* Pagination controls */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={totalCount}
        showPageSize={false}
      />
    </div>
  )
}

