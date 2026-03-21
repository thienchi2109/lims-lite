/**
 * CoA HTML Template Renderer
 *
 * Production-ready Vietnamese CDC lab CoA format.
 * Based on docs/references/test_results_new_template.tsx design.
 *
 * This module orchestrates all template sections into the complete HTML output.
 */

import type { CoAData } from '@/types'
import { escapeHtml } from './escape'
import { getStylesheet, renderWatermark } from './styles'
import { renderHeader } from './header'
import { renderPatientInfo } from './patient-info'
import { renderResultsTable } from './results-table'
import { renderSignatures } from './signatures'
import { renderAbsoluteFooter } from './footer'
import { renderMetadata } from './metadata'

// Re-export section functions for testing and direct usage
export { getStylesheet, renderWatermark } from './styles'
export { renderHeader } from './header'
export { renderPatientInfo } from './patient-info'
export { renderResultsTable } from './results-table'
export { renderSignatures } from './signatures'
export { renderAbsoluteFooter } from './footer'
export { renderMetadata } from './metadata'

/**
 * Generate HTML from CoA template
 * Production-ready Vietnamese CDC lab CoA format with blue theme
 */
export function renderCoATemplate(coaData: CoAData): string {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(coaData.sample.sample_id_display)}&margin=0`
    const logoUrl = "https://i.postimg.cc/8zFZ52j1/cdc-logo-150.png"
    const dateStr = coaData.approvalDate

    // Format date for signature section "Cần Thơ, ngày... tháng... năm..."
    let footerDateStr = dateStr;
    try {
        if (dateStr && dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            footerDateStr = `ngày ${day} tháng ${month} năm ${year}`;
        }
    } catch (e) {
        console.error('Error formatting date:', e);
    }

    return `
<!DOCTYPE html>
<html lang="vi">

<head>
    <meta charset="UTF-8">
    <title>Kết quả xét nghiệm - ${escapeHtml(coaData.sample.sample_id_display)}</title>
    <style>
        ${getStylesheet()}
    </style>
</head>

<body>
    <div class="page">
        ${renderWatermark()}
        <div class="content">
            ${renderHeader(coaData, logoUrl, qrCodeUrl)}
            ${renderPatientInfo(coaData)}
            ${renderResultsTable(coaData.results)}
            ${renderSignatures(coaData, footerDateStr)}
        </div>
        ${renderAbsoluteFooter()}
        ${renderMetadata(coaData)}
    </div>
</body>

</html>
    `
}

/**
 * Alias for backward compatibility
 * @deprecated Use renderCoATemplate instead
 */
export const generateCoAHtml = renderCoATemplate
