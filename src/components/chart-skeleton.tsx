/**
 * Chart Skeleton Component
 *
 * Loading skeleton for chart visualizations with shimmer effect.
 * Displays placeholder bars/lines during data fetching.
 */

import { Skeleton } from '@/components/ui/skeleton'

export interface ChartSkeletonProps {
  height?: number | string
  variant?: 'bar' | 'line' | 'donut'
}

export function ChartSkeleton({
  height = 300,
  variant = 'bar'
}: ChartSkeletonProps) {
  const heightValue = typeof height === 'number' ? height : parseInt(height)

  if (variant === 'donut') {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <Skeleton className="rounded-full" style={{ width: heightValue * 0.7, height: heightValue * 0.7 }} />
      </div>
    )
  }

  if (variant === 'line') {
    return (
      <div
        className="flex items-end justify-between gap-2 px-4"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {Array.from({ length: 12 }).map((_, i) => {
          const randomHeight = Math.random() * 0.6 + 0.3 // 30% to 90%
          return (
            <Skeleton
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${randomHeight * 100}%` }}
            />
          )
        })}
      </div>
    )
  }

  // Default: bar variant
  return (
    <div
      className="flex items-end justify-between gap-2 px-4"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const randomHeight = Math.random() * 0.6 + 0.3 // 30% to 90%
        return (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${randomHeight * 100}%` }}
          />
        )
      })}
    </div>
  )
}
