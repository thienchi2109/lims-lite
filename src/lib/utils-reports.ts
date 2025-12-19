/**
 * Utility functions for Reports Dashboard
 * Helpers for calculations, formatting, and date range presets
 */

import type { DateRange } from '@/types'

/**
 * Calculates TAT (Turnaround Time) in hours between two dates
 * @param receivedAt - Sample received timestamp
 * @param completedAt - Sample completed timestamp
 * @returns TAT in hours, or null if either date is missing
 */
export function calculateTATInHours(
  receivedAt: string | Date | null,
  completedAt: string | Date | null
): number | null {
  if (!receivedAt || !completedAt) return null

  const received = new Date(receivedAt).getTime()
  const completed = new Date(completedAt).getTime()

  return (completed - received) / (1000 * 60 * 60)
}

/**
 * Calculates on-time delivery rate as percentage
 * @param samples - Array of samples with TAT data
 * @param slaHours - SLA threshold in hours (default 72 for 3 days)
 * @returns On-time rate percentage (0-100)
 */
export function calculateOnTimeRate(
  samples: Array<{ tatHours: number | null }>,
  slaHours: number = 72
): number {
  if (samples.length === 0) return 0

  const onTimeSamples = samples.filter(
    (s) => s.tatHours !== null && s.tatHours <= slaHours
  )

  return (onTimeSamples.length / samples.length) * 100
}

/**
 * Formats trend indicator based on current and previous values
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Object with trend percentage and direction
 */
export function formatTrendIndicator(
  current: number,
  previous: number
): { trend: number; direction: 'up' | 'down' | 'stable' } {
  if (previous === 0) {
    // Avoid division by zero
    return { trend: 0, direction: 'stable' }
  }

  const percentageChange = ((current - previous) / previous) * 100

  // Consider changes less than 1% as stable
  if (Math.abs(percentageChange) < 1) {
    return { trend: 0, direction: 'stable' }
  }

  return {
    trend: percentageChange,
    direction: percentageChange > 0 ? 'up' : 'down',
  }
}

/**
 * Gets predefined date range presets for Reports Dashboard filters
 * @returns Object with common date range presets
 */
export function getDateRangePresets(): Record<string, DateRange> {
  const now = new Date()

  // Today (start of day to current time)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const today: DateRange = {
    start: todayStart.toISOString(),
    end: now.toISOString(),
  }

  // This Week (Monday to current time)
  const dayOfWeek = now.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - daysToMonday)
  thisWeekStart.setHours(0, 0, 0, 0)
  const thisWeek: DateRange = {
    start: thisWeekStart.toISOString(),
    end: now.toISOString(),
  }

  // This Month (1st of month to current time)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonth: DateRange = {
    start: thisMonthStart.toISOString(),
    end: now.toISOString(),
  }

  // Last 7 Days (7 days ago to current time)
  const last7DaysStart = new Date(now)
  last7DaysStart.setDate(now.getDate() - 7)
  const last7Days: DateRange = {
    start: last7DaysStart.toISOString(),
    end: now.toISOString(),
  }

  // Last 30 Days (30 days ago to current time)
  const last30DaysStart = new Date(now)
  last30DaysStart.setDate(now.getDate() - 30)
  const last30Days: DateRange = {
    start: last30DaysStart.toISOString(),
    end: now.toISOString(),
  }

  // Last Month (1st to last day of previous month)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  const lastMonth: DateRange = {
    start: lastMonthStart.toISOString(),
    end: lastMonthEnd.toISOString(),
  }

  return {
    today,
    thisWeek,
    thisMonth,
    last7Days,
    last30Days,
    lastMonth,
  }
}

/**
 * Formats a number to 2 decimal places
 * @param value - Number to format
 * @returns Formatted string with 2 decimals
 */
export function formatDecimal(value: number): string {
  return value.toFixed(2)
}

/**
 * Formats hours into a readable duration string (e.g., "2 ngày 4 giờ" or "8 giờ")
 * @param hours - Number of hours
 * @returns Formatted duration string in Vietnamese
 */
export function formatDuration(hours: number): string {
  if (hours < 24) {
    return `${Math.round(hours)} giờ`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = Math.round(hours % 24)

  if (remainingHours === 0) {
    return `${days} ngày`
  }

  return `${days} ngày ${remainingHours} giờ`
}

/**
 * Gets color code for TAT status based on SLA threshold
 * @param tatHours - TAT in hours
 * @param slaHours - SLA threshold in hours (default 72)
 * @returns Color code: 'green', 'yellow', or 'red'
 */
export function getTATColor(
  tatHours: number | null,
  slaHours: number = 72
): 'green' | 'yellow' | 'red' {
  if (tatHours === null) return 'red'

  // Green: within 80% of SLA
  if (tatHours <= slaHours * 0.8) return 'green'

  // Yellow: within SLA but above 80%
  if (tatHours <= slaHours) return 'yellow'

  // Red: exceeds SLA
  return 'red'
}

/**
 * Converts Vietnamese status to English for internal processing
 * @param status - Vietnamese status string
 * @returns English status enum value
 */
export function convertStatusToEnglish(status: string): string {
  const statusMap: Record<string, string> = {
    'Đã nhận': 'received',
    'Đã phân công': 'assigned',
    'Đang xử lý': 'in_progress',
    'Đang duyệt': 'review',
    'Hoàn thành': 'completed',
    'Đã loại bỏ': 'discarded',
  }

  return statusMap[status] || status
}

/**
 * Converts English status to Vietnamese for display
 * @param status - English status enum value
 * @returns Vietnamese status string
 */
export function convertStatusToVietnamese(status: string): string {
  const statusMap: Record<string, string> = {
    received: 'Đã nhận',
    assigned: 'Đã phân công',
    in_progress: 'Đang xử lý',
    review: 'Đang duyệt',
    completed: 'Hoàn thành',
    discarded: 'Đã loại bỏ',
  }

  return statusMap[status] || status
}

/**
 * Checks if approval queue should trigger alert
 * @param pendingCount - Number of pending approvals
 * @param avgWaitHours - Average wait time in hours
 * @returns True if alert threshold exceeded
 */
export function shouldAlertApprovalQueue(
  pendingCount: number,
  avgWaitHours: number
): boolean {
  // Alert if more than 20 samples OR average wait exceeds 24 hours
  return pendingCount > 20 || avgWaitHours > 24
}

/**
 * Formats percentage with 2 decimal places and % sign
 * @param value - Percentage value (0-100)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`
}

/**
 * Gets Vietnamese month name
 * @param monthIndex - Month index (0-11)
 * @returns Vietnamese month name
 */
export function getVietnameseMonth(monthIndex: number): string {
  const months = [
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12',
  ]

  return months[monthIndex] || ''
}

/**
 * Calculates previous period date range for trend comparison
 * @param currentRange - Current date range
 * @returns Previous period date range with same duration
 */
export function getPreviousPeriodRange(currentRange: DateRange): DateRange {
  const start = new Date(currentRange.start)
  const end = new Date(currentRange.end)

  // Calculate duration in milliseconds
  const duration = end.getTime() - start.getTime()

  // Calculate previous period by subtracting duration
  const previousEnd = new Date(start.getTime())
  const previousStart = new Date(start.getTime() - duration)

  return {
    start: previousStart.toISOString(),
    end: previousEnd.toISOString(),
  }
}
