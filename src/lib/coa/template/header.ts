/**
 * CoA Template Header Section
 *
 * Renders the header with logo, organization info, and QR code.
 */

import type { CoAData } from '@/types'
import { escapeHtml } from './escape'

/**
 * Render header section with logo, organization info, and QR code
 */
export function renderHeader(coaData: CoAData, logoUrl: string, qrCodeUrl: string): string {
    return `
        <!-- HEADER -->
        <div class="header">
            <div class="header-left">
                <img src="${logoUrl}" class="logo" alt="CDC Logo" />
            </div>
            <div class="header-center">
                <div class="org-parent">SỞ Y TẾ THÀNH PHỐ CẦN THƠ</div>
                <div class="org-name">TRUNG TÂM KIỂM SOÁT BỆNH TẬT</div>
                <div class="org-english">CAN THO CITY – CENTER FOR DISEASE CONTROL AND PREVENTION</div>
                <div class="form-name">KẾT QUẢ XÉT NGHIỆM</div>
                <div class="form-name-en">ANALYSIS RESULTS</div>
            </div>
            <div class="header-right">
                <img src="${escapeHtml(qrCodeUrl)}" class="qr-img" alt="QR Code" />
                <div class="sample-id-box">${escapeHtml(coaData.sample.sample_id_display)}</div>
            </div>
        </div>
    `
}
