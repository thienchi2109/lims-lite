/**
 * CoA Template Metadata Section
 *
 * Renders hidden metadata for verification (21 CFR Part 11 compliance).
 * Includes both approver and performer signature IDs for audit trail.
 */

import type { CoAData } from '@/types'
import { escapeHtml } from './escape'

/**
 * Render hidden metadata for verification (21 CFR Part 11 compliance)
 */
export function renderMetadata(coaData: CoAData): string {
    return `
        <!-- Hidden metadata for verification -->
        <div class="metadata">
            <span data-signature-id="${escapeHtml(coaData.signatureId)}"></span>
            <span data-performer-signature-id="${escapeHtml(coaData.performerSignatureId || '')}"></span>
            <span data-sample-id="${escapeHtml(coaData.sample.id)}"></span>
            <span data-approved-by="${escapeHtml(coaData.sample.approved_by)}"></span>
            <span data-approved-at="${escapeHtml(coaData.sample.approved_at)}"></span>
        </div>
    `
}
