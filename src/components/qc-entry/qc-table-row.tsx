import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { QCSparkline, type MiniChartDataPoint } from './qc-sparkline'

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
}

interface QCTableRowProps {
  assay: AssayWithQC
  isSelected: boolean
  qcDataPoints: MiniChartDataPoint[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_LABELS: Record<AssayWithQC['status'], string> = {
  pending: 'Chờ nhập',
  entered: 'Đã nhập',
  approved: 'Đã duyệt',
}

const STATUS_STYLES: Record<AssayWithQC['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  entered: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCTableRow({ assay, isSelected, qcDataPoints }: QCTableRowProps) {
  return (
    <Link
      href={`/analyst/qc-entry?id=${assay.id}`}
      className={cn(
        'grid grid-cols-[1fr_60px_90px_160px] items-center gap-4 px-4 py-3 border-b transition-colors',
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
        {STATUS_LABELS[assay.status]}
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
