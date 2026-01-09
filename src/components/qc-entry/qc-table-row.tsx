import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { QCSparkline, type MiniChartDataPoint } from './qc-sparkline'
import { QC_STATUS_LABELS } from './qc-chart-constants'

// ============================================================================
// TYPES
// ============================================================================

export interface AssayWithQC {
  id: string
  name: string
  level: 'L1' | 'L2'
  status: 'pending' | 'entered' | 'approved'
  mean: number
  sd: number
  specialty_id: string
}

interface QCTableRowProps {
  assay: AssayWithQC
  isSelected: boolean
  qcDataPoints: MiniChartDataPoint[]
  activeSpecialty?: string | null
  page?: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_STYLES: Record<AssayWithQC['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  entered: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCTableRow({ assay, isSelected, qcDataPoints, activeSpecialty, page }: QCTableRowProps) {
  // Build URL params preserving specialty and page
  const params = new URLSearchParams()
  if (activeSpecialty) params.set('specialty', activeSpecialty)
  if (page && page > 1) params.set('page', String(page))
  params.set('id', assay.id)

  const href = `/analyst/qc-entry?${params.toString()}`

  return (
    <Link
      href={href}
      aria-label={`Xem chi tiết QC ${assay.name} ${assay.level}`}
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        'grid grid-cols-[minmax(200px,3fr)_80px_120px_minmax(150px,2fr)] items-center gap-4 px-4 py-3 border-b transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-accent'
      )}
    >
      {/* Name */}
      <span className="font-medium truncate">{assay.name}</span>

      {/* Level Badge */}
      <Badge variant="secondary" className="justify-self-center">
        {assay.level}
      </Badge>

      {/* Status Badge */}
      <Badge
        variant="outline"
        className={cn('justify-self-center', STATUS_STYLES[assay.status])}
      >
        {QC_STATUS_LABELS[assay.status]}
      </Badge>

      {/* Sparkline */}
      <div className="justify-self-end">
        <QCSparkline
          dataPoints={qcDataPoints}
          mean={assay.mean}
          sd={assay.sd}
        />
      </div>
    </Link>
  )
}
