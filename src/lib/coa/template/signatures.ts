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

/**
 * Render signatures section with performer (left) and approver (right) columns
 */
export function renderSignatures(coaData: CoAData, footerDateStr: string): string {
    // Performer (analyst) signature - left column
    const performerSignatureHtml = coaData.performerSignature
        ? `<img src="${coaData.performerSignature}" alt="Chu ky nguoi thuc hien" class="signature-image" />`
        : ''

    const performerNameHtml = coaData.performerName
        ? `KTV. ${coaData.performerName}`
        : 'KTV. ...........................'

    // Approver (manager) signature - right column
    const approverSignatureHtml = coaData.approverSignature
        ? `<img src="${coaData.approverSignature}" alt="Chu ky" class="signature-image" />`
        : ''

    return `
        <!-- SIGNATURES -->
        <div class="signatures">
            <div class="sig-col">
                <div class="sig-date invisible">Spacer</div>
                <div class="sig-title">Nguoi thuc hien</div>
                ${performerSignatureHtml}
                <div class="sig-name">${performerNameHtml}</div>
            </div>
            <div class="sig-col">
                <div class="sig-date">Can Tho, ${footerDateStr}</div>
                <div class="sig-title">Lanh dao khoa Xet nghiem</div>
                ${approverSignatureHtml}
                <div class="sig-name">${coaData.approverName}</div>
            </div>
        </div>
    `
}
