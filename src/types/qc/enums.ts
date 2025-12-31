import { z } from 'zod'

// ============================================================================
// QC ENUMS - Matching PostgreSQL ENUMs from migration
// ============================================================================

/**
 * QC session mode - How QC is linked to patient results
 * - daily: One session per day per assay
 * - batch: One session per batch of samples
 * - shift: One session per work shift
 */
export const QCSessionMode = z.enum(['daily', 'batch', 'shift'])
export type QCSessionMode = z.infer<typeof QCSessionMode>

/**
 * QC status - Overall status of a QC session
 * - pending: Awaiting QC entry
 * - pass: All QC passed
 * - warning: 1-2s rule triggered (warning only)
 * - blocked: Reject rule triggered, patient results blocked
 * - resolved: Violation resolved by manager
 */
export const QCStatus = z.enum(['pending', 'pass', 'warning', 'blocked', 'resolved'])
export type QCStatus = z.infer<typeof QCStatus>

/**
 * QC result status - Status of individual QC measurement
 * - pass: Within acceptable limits
 * - warning: 1-2s warning rule triggered
 * - reject: Rejection rule triggered
 */
export const QCResultStatus = z.enum(['pass', 'warning', 'reject'])
export type QCResultStatus = z.infer<typeof QCResultStatus>

/**
 * Westgard rules - Multi-rule QC evaluation
 * - 1-2s: Warning rule (|z| > 2)
 * - 1-3s: Random error (|z| > 3)
 * - 2-2s: Systematic error (2 consecutive > 2SD same side)
 * - R-4s: Range error (within-run range > 4SD)
 * - 4-1s: Trend (4 consecutive > 1SD same side)
 * - 10-x: Shift (10 consecutive same side of mean)
 */
export const WestgardRule = z.enum(['1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10-x'])
export type WestgardRule = z.infer<typeof WestgardRule>

/**
 * QC control level
 * - low: Low concentration control
 * - normal: Normal concentration control
 * - high: High concentration control
 */
export const QCLevel = z.enum(['low', 'normal', 'high'])
export type QCLevel = z.infer<typeof QCLevel>
