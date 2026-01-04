import Link from 'next/link'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

import { QCEntryForm } from './qc-entry-form'
import { LeveyJenningsChart } from './levey-jennings-chart'
import { QCRecentHistory, type QCHistoryEntry } from './qc-recent-history'
import type { MiniChartDataPoint } from './qc-sparkline'
import type { AssayWithQC } from './qc-table-row'

// ============================================================================
// TYPES
// ============================================================================

interface QCDetailSheetProps {
  assay: AssayWithQC
  qcDataPoints: Array<MiniChartDataPoint & { measuredAt: string }>
  recentHistory: QCHistoryEntry[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_STYLES: Record<AssayWithQC['level'], string> = {
  L1: 'bg-blue-100 text-blue-800 border-blue-200',
  L2: 'bg-purple-100 text-purple-800 border-purple-200',
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * QC Detail Sheet - Server Component
 *
 * Fixed right panel that slides in when a QC assay is selected.
 * Contains the entry form, Levey-Jennings chart, and recent history.
 *
 * Rendered conditionally when ?id query param exists.
 */
export function QCDetailSheet({
  assay,
  qcDataPoints,
  recentHistory,
}: QCDetailSheetProps) {
  return (
    <aside
      className="
        fixed right-0 top-0 h-full w-[400px] z-50
        bg-background border-l shadow-xl
        transform translate-x-0 transition-transform duration-300 ease-out
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="shrink-0"
        >
          <Link href="/analyst/qc-entry" aria-label="Đóng">
            <X className="h-5 w-5" />
          </Link>
        </Button>

        <h2 className="flex-1 font-semibold text-lg truncate">
          {assay.name}
        </h2>

        <Badge
          variant="outline"
          className={LEVEL_STYLES[assay.level]}
        >
          {assay.level}
        </Badge>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="h-[calc(100%-57px)]">
        <div className="p-4 space-y-6">
          {/* Section Heading */}
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Chi tiết QC
          </h3>

          {/* Entry Form */}
          <section>
            <QCEntryForm assayId={assay.id} />
          </section>

          <Separator />

          {/* Levey-Jennings Chart */}
          <section className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Biểu đồ Levey-Jennings
            </h4>
            <LeveyJenningsChart
              mean={assay.mean}
              sd={assay.sd}
              dataPoints={qcDataPoints}
              height={220}
            />
          </section>

          <Separator />

          {/* Recent History */}
          <section>
            <QCRecentHistory entries={recentHistory} />
          </section>
        </div>
      </ScrollArea>
    </aside>
  )
}
