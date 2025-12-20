/**
 * KPI Card Component
 *
 * Generic reusable card for displaying KPI metrics with:
 * - Metric value and unit
 * - Trend indicator (up/down/stable with percentage)
 * - Comparison text (vs previous period)
 * - Icon and gradient theming
 * - Alert badge for threshold violations
 * - Loading skeleton state
 * - Glassmorphism styling
 */

import { ReactNode } from 'react'
import { ArrowUp, ArrowDown, Minus, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export interface KPICardProps {
  title: string
  value: string | number
  unit?: string
  trend?: {
    value: number // Percentage change (-100 to +Infinity)
    direction: 'up' | 'down' | 'stable'
    label?: string // e.g., "vs tháng trước"
  }
  trendType?: 'standard' | 'inverse' // Standard: up=good, Inverse: down=good (for TAT, error rates)
  icon: ReactNode
  gradient: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange'
  alert?: {
    show: boolean
    message: string
  }
  extra?: ReactNode
  isLoading?: boolean
  onClick?: () => void
  className?: string
}

const gradientStyles = {
  blue: 'from-sky-100/80 to-blue-50/40 border-sky-200/50 dark:from-sky-950/30 dark:to-blue-950/20 dark:border-sky-800/30',
  green: 'from-emerald-100/80 to-green-50/40 border-emerald-200/50 dark:from-emerald-950/30 dark:to-green-950/20 dark:border-emerald-800/30',
  yellow: 'from-amber-100/80 to-yellow-50/40 border-amber-200/50 dark:from-amber-950/30 dark:to-yellow-950/20 dark:border-amber-800/30',
  red: 'from-rose-100/80 to-red-50/40 border-rose-200/50 dark:from-rose-950/30 dark:to-red-950/20 dark:border-rose-800/30',
  purple: 'from-violet-100/80 to-purple-50/40 border-violet-200/50 dark:from-violet-950/30 dark:to-purple-950/20 dark:border-violet-800/30',
  orange: 'from-orange-100/80 to-orange-50/40 border-orange-200/50 dark:from-orange-950/30 dark:to-orange-950/20 dark:border-orange-800/30',
}

const iconColorStyles = {
  blue: 'text-sky-600 dark:text-sky-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  red: 'text-rose-600 dark:text-rose-400',
  purple: 'text-violet-600 dark:text-violet-400',
  orange: 'text-orange-600 dark:text-orange-400',
}

const trendColorStyles: Record<'standard' | 'inverse', Record<'up' | 'down' | 'stable', string>> = {
  standard: {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    stable: 'text-gray-600 dark:text-gray-400',
  },
  inverse: {
    up: 'text-red-600 dark:text-red-400',    // Up is bad for TAT/errors
    down: 'text-green-600 dark:text-green-400', // Down is good for TAT/errors
    stable: 'text-gray-600 dark:text-gray-400',
  },
}

export function KPICard({
  title,
  value,
  unit,
  trend,
  trendType = 'standard',
  icon,
  gradient,
  alert,
  extra,
  isLoading = false,
  onClick,
  className,
}: KPICardProps) {
  if (isLoading) {
    return (
      <Card className={cn('relative overflow-hidden', className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-24 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    )
  }

  const cardContent = (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        'bg-gradient-to-br backdrop-blur-sm',
        gradientStyles[gradient],
        onClick && 'cursor-pointer hover:shadow-lg hover:scale-[1.02]',
        className
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className={cn('p-2 rounded-lg bg-background/50', iconColorStyles[gradient])}>
            {icon}
          </div>
        </div>
        {/* Alert Badge - moved below header to avoid overlap */}
        {alert?.show && (
          <div className="flex items-center gap-1 px-2 py-1 mt-2 rounded-full bg-red-500/20 border border-red-500/50 text-red-600 dark:text-red-400 text-xs font-medium w-fit">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {alert.message}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Metric Value */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground font-medium">
              {unit}
            </span>
          )}
        </div>

        {/* Trend Indicator */}
        {trend && (
          <div className="flex items-center gap-2 text-sm">
            <div className={cn('flex items-center gap-1', trendColorStyles[trendType][trend.direction])}>
              {trend.direction === 'up' && <ArrowUp className="h-4 w-4" aria-hidden="true" />}
              {trend.direction === 'down' && <ArrowDown className="h-4 w-4" aria-hidden="true" />}
              {trend.direction === 'stable' && <Minus className="h-4 w-4" aria-hidden="true" />}
              <span className="font-semibold">
                {trend.value > 0 && '+'}
                {trend.value.toFixed(1)}%
              </span>
            </div>
            {trend.label && (
              <span className="text-muted-foreground text-xs">
                {trend.label}
              </span>
            )}
          </div>
        )}

        {/* Extra Content */}
        {extra && (
          <div className="pt-2 mt-2 border-t border-border/50">
            {extra}
          </div>
        )}
      </CardContent>
    </Card>
  )

  // Wrap in button for keyboard accessibility when clickable
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg"
        aria-label={`${title}: ${value}${unit ? ' ' + unit : ''}`}
      >
        {cardContent}
      </button>
    )
  }

  return cardContent
}
