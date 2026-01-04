/**
 * QC Chart Constants
 * Shared color schemes, labels, and constants for QC visualization components
 */

/**
 * Color scheme for QC charts and visualizations
 */
export const QC_CHART_COLORS = {
  pass: 'hsl(142, 76%, 36%)',    // green
  warning: 'hsl(48, 96%, 53%)',  // yellow
  reject: 'hsl(0, 84%, 60%)',    // red
  mean: 'hsl(217, 91%, 60%)',    // blue
  sd2: 'hsl(48, 96%, 53%)',      // yellow
  sd3: 'hsl(0, 84%, 60%)',       // red
} as const

/**
 * Vietnamese labels for QC entry status
 */
export const QC_STATUS_LABELS: Record<'pending' | 'entered' | 'approved', string> = {
  pending: 'Chờ nhập',
  entered: 'Đã nhập',
  approved: 'Đã duyệt',
}

/**
 * Vietnamese labels for QC result evaluation status
 */
export const QC_RESULT_STATUS_LABELS: Record<'pass' | 'warning' | 'reject', string> = {
  pass: 'Đạt',
  warning: 'Cảnh báo',
  reject: 'Vi phạm',
}
