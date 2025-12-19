/**
 * KPI Cards Grid Component
 *
 * Responsive grid layout for KPI cards:
 * - Desktop (lg): 3 columns
 * - Tablet (md): 2 columns
 * - Mobile: 1 column
 *
 * Usage:
 * <KPICardsGrid>
 *   <KPICard {...} />
 *   <KPICard {...} />
 *   <KPICard {...} />
 * </KPICardsGrid>
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface KPICardsGridProps {
  children: ReactNode
  className?: string
}

export function KPICardsGrid({ children, className }: KPICardsGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        'grid-cols-1', // Mobile: 1 column
        'md:grid-cols-2', // Tablet: 2 columns
        'lg:grid-cols-3', // Desktop: 3 columns
        className
      )}
    >
      {children}
    </div>
  )
}
