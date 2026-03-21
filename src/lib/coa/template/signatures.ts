/**
 * CoA Template Signatures Section
 *
 * Renders dual signature columns:
 * - Left: Performer (analyst) signature
 * - Right: Approver (manager) signature
 *
 * 21 CFR Part 11 compliant with both e-signatures.
 */

import type { CoAData } from '@/types'
import { escapeHtml } from './escape'

/**
 * Render signatures section with performer (left) and approver (right) columns
 */
export function renderSignatures(coaData: CoAData, footerDateStr: string): string {
    // Performer (analyst) signature - left column
    const performerSignatureHtml = coaData.performerSignature
        ? `<img src="${escapeHtml(coaData.performerSignature)}" alt="Chữ ký người thực hiện" class="signature-image" />`
        : ''

    const performerNameHtml = coaData.performerName
        ? `KTV. ${escapeHtml(coaData.performerName)}`
        : 'KTV. ...........................'

    // Approver (manager) signature - right column
    const approverSignatureHtml = coaData.approverSignature
        ? `<img src="${escapeHtml(coaData.approverSignature)}" alt="Chữ ký" class="signature-image" />`
        : ''

    return `
        <!-- SIGNATURES -->
        <div class="signatures">
            <div class="sig-col">
                <div class="sig-date invisible">Spacer</div>
                <div class="sig-title">Người thực hiện</div>
                ${performerSignatureHtml}
                <div class="sig-name">${performerNameHtml}</div>
            </div>
            <div class="sig-col">
                <div class="sig-date">Cần Thơ, ${escapeHtml(footerDateStr)}</div>
                <div class="sig-title">Lãnh đạo khoa Xét nghiệm</div>
                ${approverSignatureHtml}
                <div class="sig-name">${escapeHtml(coaData.approverName)}</div>
            </div>
        </div>
    `
}
