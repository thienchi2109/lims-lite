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
  
  if (variant === 'donut') {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <Skeleton className="h-[70%] w-auto aspect-square rounded-full" />
      </div>
    )
  }

  if (variant === 'line') {
    return (
      <div
        className="flex items-end justify-between gap-2 px-4"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {/* Deterministic "random" heights for line chart (more points) to avoid hydration mismatch */}
        {[0.4, 0.6, 0.5, 0.7, 0.6, 0.8, 0.7, 0.9, 0.6, 0.5, 0.4, 0.3].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
    )
  }

  // Default: bar variant
  return (
    <div
      className="flex items-end justify-between gap-2 px-4"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {/* Deterministic "random" heights for bar chart (fewer points) to avoid hydration mismatch */}
      {[0.8, 0.4, 0.9, 0.5, 0.7, 0.3].map((h, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  )
}