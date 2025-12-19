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
  isLoading?: boolean
  onClick?: () => void
  className?: string
}

const gradientStyles = {
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  green: 'from-green-500/20 to-green-600/10 border-green-500/30',
  yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
  red: 'from-red-500/20 to-red-600/10 border-red-500/30',
  purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
}

const iconColorStyles = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  red: 'text-red-500',
  purple: 'text-purple-500',
  orange: 'text-orange-500',
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
      {/* Alert Badge */}
      {alert?.show && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/50 text-red-600 dark:text-red-400 text-xs font-medium">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {alert.message}
        </div>
      )}

      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className={cn('p-2 rounded-lg bg-background/50', iconColorStyles[gradient])}>
            {icon}
          </div>
        </div>
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
