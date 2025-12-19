/**
 * Recharts Theme Configuration
 *
 * Custom theme matching glassmorphism design:
 * - Color palette from KPI card gradients
 * - Vietnamese-friendly font stack
 * - Accessible contrast ratios
 * - Dark mode support via CSS variables
 */

export const chartColors = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  purple: '#a855f7',
  orange: '#f97316',
  gray: '#64748b',
  muted: 'hsl(var(--muted-foreground))',
}

export const chartConfig = {
  // Axis styling
  axis: {
    stroke: 'hsl(var(--border))',
    fontSize: 12,
    fontFamily: 'inherit',
  },

  // Grid styling
  grid: {
    stroke: 'hsl(var(--border))',
    strokeDasharray: '3 3',
    opacity: 0.3,
  },

  // Tooltip styling
  tooltip: {
    contentStyle: {
      backgroundColor: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      fontSize: '12px',
      padding: '8px 12px',
    },
    labelStyle: {
      color: 'hsl(var(--foreground))',
      fontWeight: 600,
      marginBottom: '4px',
    },
    itemStyle: {
      color: 'hsl(var(--muted-foreground))',
      padding: '2px 0',
    },
  },

  // Legend styling
  legend: {
    iconType: 'circle' as const,
    wrapperStyle: {
      fontSize: '12px',
      paddingTop: '12px',
    },
  },
}

/**
 * Get color by name from theme palette
 */
export function getChartColor(name: keyof typeof chartColors): string {
  return chartColors[name]
}

/**
 * Format Vietnamese number with thousand separators
 * Example: 1234567 -> "1.234.567"
 */
export function formatVietnameseNumber(value: number): string {
  return value.toLocaleString('vi-VN')
}

/**
 * Format Vietnamese date for chart axes
 * Example: 2024-01-15 -> "15/01"
 */
export function formatChartDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${day}/${month}`
}

/**
 * Format Vietnamese date with year
 * Example: 2024-01-15 -> "15/01/2024"
 */
export function formatFullDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}
