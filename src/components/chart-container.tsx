/**
 * Chart Container Component
 *
 * Reusable wrapper for Recharts visualizations with:
 * - Title and optional subtitle
 * - Loading state with skeleton
 * - Empty state message
 * - Glassmorphism styling matching KPI cards
 * - Responsive container with min-height
 */

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ChartSkeleton } from '@/components/chart-skeleton'

export interface ChartContainerProps {
  title: string
  subtitle?: string
  children: ReactNode
  isLoading?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  className?: string
  height?: number | string
}

export function ChartContainer({
  title,
  subtitle,
  children,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'Không có dữ liệu',
  className,
  height = 300,
}: ChartContainerProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        'bg-gradient-to-br from-blue-500/10 to-purple-600/5 backdrop-blur-sm border-blue-500/20',
        className
      )}
    >
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <ChartSkeleton height={height} />
        ) : isEmpty ? (
          <div
            className="flex items-center justify-center text-muted-foreground text-sm"
            style={{ height: typeof height === 'number' ? `${height}px` : height }}
          >
            {emptyMessage}
          </div>
        ) : (
          <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
