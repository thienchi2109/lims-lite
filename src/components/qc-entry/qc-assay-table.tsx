'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
  totalPages: number
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
  totalPages,
  totalCount,
}: QCAssayTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

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
      {assays.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Hiển thị{' '}
              <span className="font-medium text-foreground">
                {(page - 1) * pageSize + 1}
              </span>{' '}
              -{' '}
              <span className="font-medium text-foreground">
                {Math.min(page * pageSize, totalCount)}
              </span>{' '}
              của{' '}
              <span className="font-medium text-foreground">{totalCount}</span>{' '}
              QC
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateQuery({ page: String(Math.max(1, page - 1)) })}
              disabled={page === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs font-medium min-w-[3rem] text-center">
              {page} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateQuery({ page: String(Math.min(totalPages, page + 1)) })}
              disabled={page === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

