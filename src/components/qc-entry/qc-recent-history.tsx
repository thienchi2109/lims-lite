import { cn } from '@/lib/utils'
import { QC_RESULT_STATUS_LABELS } from './qc-chart-constants'

// ============================================================================
// TYPES
// ============================================================================

export interface QCHistoryEntry {
  date: string
  value: number
  status: 'pass' | 'warning' | 'reject'
}

interface QCRecentHistoryProps {
  entries: QCHistoryEntry[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_STYLES: Record<QCHistoryEntry['status'], string> = {
  pass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  reject: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCRecentHistory({ entries }: QCRecentHistoryProps) {
  const recentEntries = entries.slice(0, 5)

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Lịch sử gần đây
      </h4>

      {recentEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Chưa có dữ liệu
        </p>
      ) : (
        <ul className="space-y-2">
          {recentEntries.map((entry, index) => (
            <li
              key={`${entry.date}-${index}`}
              className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md bg-slate-50 dark:bg-slate-800/50"
            >
              <span className="text-xs text-muted-foreground">{entry.date}</span>
              <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
                {entry.value.toFixed(2)}
              </span>
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  STATUS_STYLES[entry.status]
                )}
              >
                {QC_RESULT_STATUS_LABELS[entry.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
