/**
 * CoA HTML Template Renderer
 *
 * Production-ready Vietnamese CDC lab CoA format.
 * Based on docs/references/test_results_new_template.tsx design.
 */

import type { CoAData } from '@/types'
import type { TestResult } from './helpers'

/**
 * Generate HTML from CoA template
 * Production-ready Vietnamese CDC lab CoA format with blue theme
 */
export function renderCoATemplate(coaData: CoAData): string {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${coaData.sample.sample_id_display}&margin=0`
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
    <title>Kết quả xét nghiệm - ${coaData.sample.sample_id_display}</title>
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
 * CSS Stylesheet for CoA template - Blue theme, A4 layout
 */
function getStylesheet(): string {
    return `
        /* A4 Page Configuration */
        @page {
            size: A4;
            margin: 0;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Times New Roman', serif;
            font-size: 14px;
            color: #000;
            line-height: 1.4;
            background: #f3f4f6;
            margin: 0;
            padding: 32px;
        }

        /* A4 Page Container: 210mm x 297mm */
        .page {
            width: 210mm;
            min-height: 297mm;
            background: #fff;
            position: relative;
            margin: 0 auto;
            padding: 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        /* Watermark */
        .watermark {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            overflow: hidden;
            z-index: 0;
        }

        .watermark-text {
            font-size: 100px;
            font-weight: bold;
            color: #93c5fd;
            opacity: 0.1;
            transform: rotate(-45deg);
            white-space: nowrap;
            letter-spacing: 0.2em;
            font-family: 'Times New Roman', serif;
        }

        /* Content wrapper */
        .content {
            position: relative;
            z-index: 10;
            padding-bottom: 120px;
        }

        /* HEADER */
        .header {
            display: flex;
            align-items: flex-start;
            gap: 24px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }

        .header-left {
            flex-shrink: 0;
            padding-top: 4px;
        }

        .logo {
            width: 96px;
            height: 96px;
            object-fit: contain;
        }

        .header-center {
            flex: 1;
            text-align: center;
        }

        .org-parent {
            font-size: 14px;
            color: #2563eb;
            font-weight: 500;
            line-height: 1;
        }

        .org-name {
            font-size: 18px;
            font-weight: bold;
            color: #1d4ed8;
            margin-top: 4px;
            line-height: 1.2;
        }

        .org-english {
            font-size: 11px;
            color: #4b5563;
            margin-top: 4px;
            margin-bottom: 12px;
            line-height: 1;
        }

        .form-name {
            font-size: 28px;
            font-weight: bold;
            color: #1d4ed8;
            letter-spacing: 0.05em;
            line-height: 1;
        }

        .form-name-en {
            font-size: 18px;
            font-style: italic;
            color: #2563eb;
            margin-top: 4px;
            line-height: 1.2;
        }

        .header-right {
            flex-shrink: 0;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .qr-img {
            width: 90px;
            height: 90px;
            margin-bottom: 8px;
        }

        .sample-id-box {
            font-family: monospace;
            font-size: 12px;
            font-weight: bold;
            border: 1px solid #000;
            padding: 4px 8px;
            border-radius: 4px;
        }

        /* PATIENT INFO - Grid Layout */
        .info-section {
            margin-bottom: 24px;
        }

        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 32px;
        }

        .info-row {
            display: flex;
        }

        .info-row.full-width {
            grid-column: 1 / -1;
        }

        .info-label {
            font-weight: 600;
            margin-right: 8px;
            white-space: nowrap;
        }

        .info-value {
            font-weight: 400;
        }

        .info-value.highlight {
            text-transform: uppercase;
            font-weight: bold;
            font-size: 16px;
        }

        /* RESULTS TABLE */
        .res-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 14px;
        }

        .res-table th,
        .res-table td {
            border: 1px solid #9ca3af;
            padding: 8px;
            vertical-align: middle;
        }

        .res-table th {
            background-color: #dbeafe;
            font-weight: 600;
            text-align: center;
        }

        .res-group-header td {
            background-color: #ffe4e6;
            font-weight: bold;
            color: #be123c;
            text-transform: uppercase;
            padding-left: 16px;
        }

        .res-name {
            font-weight: 500;
            text-align: left;
        }

        .res-value {
            font-weight: bold;
            text-align: center;
            font-size: 15px;
        }

        .res-unit {
            text-align: center;
        }

        .res-range {
            text-align: center;
            font-style: italic;
        }

        .res-method {
            text-align: center;
            font-size: 12px;
        }

        /* SIGNATURES */
        .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 32px;
        }

        .sig-col {
            width: 45%;
            text-align: center;
        }

        .sig-date {
            font-style: italic;
            margin-bottom: 4px;
            height: 20px;
        }

        .sig-date.invisible {
            visibility: hidden;
        }

        .sig-title {
            font-weight: 600;
            margin-bottom: 96px;
        }

        .sig-name {
            font-weight: bold;
        }

        .signature-image {
            max-width: 200px;
            max-height: 80px;
            display: block;
            margin: -88px auto 8px auto;
        }

        /* FOOTER - Absolute positioned */
        .absolute-footer {
            position: absolute;
            left: 32px;
            right: 32px;
            bottom: 32px;
            z-index: 10;
            border-top: 2px solid #2563eb;
            padding-top: 8px;
            background: #fff;
            font-size: 9px;
        }

        .footer-disclaimer {
            font-style: italic;
            color: #1d4ed8;
            margin-bottom: 4px;
        }

        .footer-info {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .footer-address {
            display: flex;
            align-items: flex-start;
            gap: 8px;
        }

        .footer-address-icon {
            width: 12px;
            height: 12px;
            color: #1d4ed8;
            flex-shrink: 0;
            margin-top: 2px;
        }

        .footer-address-text {
            color: #1d4ed8;
        }

        .footer-code {
            text-align: right;
            color: #1d4ed8;
        }

        /* Hidden metadata */
        .metadata {
            display: none;
        }

        /* Print styles */
        @media print {
            body {
                background: #fff;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .page {
                box-shadow: none;
                margin: 0;
                padding: 32px;
            }
        }
    `
}

/**
 * Render watermark
 */
function renderWatermark(): string {
    return `
        <!-- WATERMARK -->
        <div class="watermark">
            <div class="watermark-text">CDC CAN THO</div>
        </div>
    `
}

/**
 * Render header section with logo, organization info, and QR code
 */
function renderHeader(coaData: CoAData, logoUrl: string, qrCodeUrl: string): string {
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
                <img src="${qrCodeUrl}" class="qr-img" alt="QR Code" />
                <div class="sample-id-box">${coaData.sample.sample_id_display}</div>
            </div>
        </div>
    `
}

/**
 * Render patient and sample information - Grid layout
 */
function renderPatientInfo(coaData: CoAData): string {
    const receivedDate = coaData.sample.received_date
        ? new Date(coaData.sample.received_date).toLocaleDateString('vi-VN')
        : 'N/A'
    const testingDate = coaData.testingDate
        ? new Date(coaData.testingDate).toLocaleDateString('vi-VN')
        : 'N/A'
    const dob = coaData.sample.client_dob
        ? new Date(coaData.sample.client_dob).toLocaleDateString('vi-VN')
        : 'N/A'

    return `
        <!-- PATIENT & SAMPLE INFO -->
        <div class="info-section">
            <div class="info-grid">
                <div class="info-row full-width">
                    <span class="info-label">Khách hàng:</span>
                    <span class="info-value highlight">${coaData.sample.client_name || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Mã mẫu:</span>
                    <span class="info-value">${coaData.sample.sample_id_display}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Loại mẫu:</span>
                    <span class="info-value">${coaData.sample.sample_type || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Ngày sinh:</span>
                    <span class="info-value">${dob}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Giới tính:</span>
                    <span class="info-value">${coaData.sample.client_gender || 'N/A'}</span>
                </div>
                <div class="info-row full-width">
                    <span class="info-label">Địa chỉ:</span>
                    <span class="info-value">${coaData.sample.client_address || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Số BHYT:</span>
                    <span class="info-value">${coaData.sample.client_health_insurance_num || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Chất lượng mẫu:</span>
                    <span class="info-value">${coaData.manualInputs?.sampleQuality || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Ngày nhận mẫu:</span>
                    <span class="info-value">${receivedDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Ngày xét nghiệm:</span>
                    <span class="info-value">${testingDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Ngày phê duyệt:</span>
                    <span class="info-value">${coaData.approvalDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Bác sĩ chỉ định:</span>
                    <span class="info-value">${coaData.manualInputs?.referrer || 'N/A'}</span>
                </div>
            </div>
        </div>
    `
}

/**
 * Render test results table with blue header and light-red specialty groups
 */
function renderResultsTable(results: TestResult[]): string {
    // Group results by lab specialty
    const groups: { [key: string]: TestResult[] } = {}
    const order: string[] = []

    results.forEach(result => {
        const key = result.lab_specialty_name || 'KHÁC'
        if (!groups[key]) {
            groups[key] = []
            order.push(key)
        }
        groups[key].push(result)
    })

    let tbody = ''
    if (results.length === 0) {
        tbody = `
            <tr>
                <td colspan="6" style="text-align: center; font-style: italic; color: #666;">
                    Không có kết quả xét nghiệm
                </td>
            </tr>
        `
    } else {
        tbody = order.map(groupName => {
            let groupHtml = ''

            // Add group header if not 'KHÁC' or 'N/A'
            if (groupName !== 'KHÁC' && groupName !== 'N/A') {
                groupHtml += `
                    <tr class="res-group-header">
                        <td colspan="6">${groupName}</td>
                    </tr>
                `
            }

            // Add result rows for this group
            groupHtml += groups[groupName].map((result) => {
                const totalIndex = results.indexOf(result) + 1
                return `
                    <tr>
                        <td style="text-align: center;">${totalIndex}</td>
                        <td class="res-name">${result.assay_name}</td>
                        <td class="res-value">${result.value || '-'}</td>
                        <td class="res-unit">${result.unit || ''}</td>
                        <td class="res-range">${result.normal_range || ''}</td>
                        <td class="res-method">${result.method_name || ''}</td>
                    </tr>
                `
            }).join('')

            return groupHtml
        }).join('')
    }

    return `
        <!-- RESULTS TABLE -->
        <table class="res-table">
            <thead>
                <tr>
                    <th width="5%">STT</th>
                    <th width="30%">Tên xét nghiệm</th>
                    <th width="15%">Kết quả</th>
                    <th width="10%">Đơn vị</th>
                    <th width="20%">Khoảng tham chiếu</th>
                    <th width="20%">Phương pháp</th>
                </tr>
            </thead>
            <tbody>
                ${tbody}
            </tbody>
        </table>
    `
}

/**
 * Render signatures section - Reference style (centered, no uppercase)
 */
function renderSignatures(coaData: CoAData, footerDateStr: string): string {
    return `
        <!-- SIGNATURES -->
        <div class="signatures">
            <div class="sig-col">
                <div class="sig-date invisible">Spacer</div>
                <div class="sig-title">Người thực hiện</div>
                <div class="sig-name">KTV. ...........................</div>
            </div>
            <div class="sig-col">
                <div class="sig-date">Cần Thơ, ${footerDateStr}</div>
                <div class="sig-title">Lãnh đạo khoa Xét nghiệm</div>
                ${coaData.approverSignature ? `<img src="${coaData.approverSignature}" alt="Chữ ký" class="signature-image" />` : ''}
                <div class="sig-name">${coaData.approverName}</div>
            </div>
        </div>
    `
}

/**
 * Render footer - Absolute positioned at bottom
 */
function renderAbsoluteFooter(): string {
    return `
        <!-- FOOTER -->
        <div class="absolute-footer">
            <div class="footer-disclaimer">
                Kết quả xét nghiệm chỉ có giá trị trên mẫu thử.
            </div>
            <div class="footer-disclaimer">
                Kết quả nằm ngoài khoảng tham chiếu, yêu cầu gặp bác sĩ chỉ định.
            </div>
            <div class="footer-info">
                <div class="footer-address">
                    <svg class="footer-address-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                    </svg>
                    <div class="footer-address-text">
                        <div>Số 01 Ngô Đức Kế, P. Ninh Kiều, Tp. Cần Thơ</div>
                        <div>Số 400 Nguyễn Văn Cừ nối dài, P. An Bình, Tp. Cần Thơ</div>
                    </div>
                </div>
                <div class="footer-code">
                    <div>CDC.STI.M.P.6.12</div>
                    <div>BH: 01 (2025)</div>
                </div>
            </div>
        </div>
    `
}

/**
 * Render hidden metadata for verification (21 CFR Part 11 compliance)
 */
function renderMetadata(coaData: CoAData): string {
    return `
        <!-- Hidden metadata for verification -->
        <div class="metadata">
            <span data-signature-id="${coaData.signatureId}"></span>
            <span data-sample-id="${coaData.sample.id}"></span>
            <span data-approved-by="${coaData.sample.approved_by}"></span>
            <span data-approved-at="${coaData.sample.approved_at}"></span>
        </div>
    `
}
