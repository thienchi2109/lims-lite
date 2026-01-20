/**
 * CoA Template Metadata Section
 *
 * Renders hidden metadata for verification (21 CFR Part 11 compliance).
 * Includes both approver and performer signature IDs for audit trail.
 */

import type { CoAData } from '@/types'

/**
 * Render hidden metadata for verification (21 CFR Part 11 compliance)
 */
export function renderMetadata(coaData: CoAData): string {
    return `
        <!-- Hidden metadata for verification -->
        <div class="metadata">
            <span data-signature-id="${coaData.signatureId}"></span>
            <span data-performer-signature-id="${coaData.performerSignatureId || ''}"></span>
            <span data-sample-id="${coaData.sample.id}"></span>
            <span data-approved-by="${coaData.sample.approved_by}"></span>
            <span data-approved-at="${coaData.sample.approved_at}"></span>
        </div>
    `
}
