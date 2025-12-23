/**
 * CoA HTML Template Renderer
 *
 * Production-ready Vietnamese CDC lab CoA format.
 * Based on docs/references/CoATemplate.html structure.
 */

import type { CoAData } from '@/types'
import type { TestResult } from './helpers'

/**
 * Generate HTML from CoA template
 * Production-ready Vietnamese CDC lab CoA format
 */
export function renderCoATemplate(coaData: CoAData): string {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${coaData.sample.sample_id_display}&margin=0`
    const logoUrl = "https://i.postimg.cc/8zFZ52j1/cdc-logo-150.png"
    const dateStr = coaData.approvalDate

    // Format date for footer "Cần Thơ, ngày... tháng... năm..."
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
    <div class="container">
        ${renderHeader(coaData, logoUrl, qrCodeUrl)}
        ${renderPatientInfo(coaData, dateStr)}
        ${renderAdministrativeInfo(coaData)}
        ${renderSampleInfo(coaData)}
        ${renderResultsTable(coaData.results)}
        ${renderFooter(coaData, footerDateStr)}
        ${renderMetadata(coaData)}
    </div>
</body>

</html>
    `
}

/**
 * CSS Stylesheet for CoA template
 */
function getStylesheet(): string {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');

        /* Cấu hình khổ giấy A4 */
        @page {
            margin: 15mm;
            size: A4;
        }

        body {
            font-family: 'Times New Roman', serif;
            font-size: 14px;
            color: #000;
            line-height: 1.4;
            background: #fff;
            margin: 0;
            padding: 10px;
        }

        .container {
            width: 100%;
            margin: 0 auto;
        }

        /* HEADER */
        .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 25px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }

        .header-left {
            flex: 0 0 15%;
            display: flex;
            justify-content: center;
        }

        .logo {
            width: 100px;
            height: auto;
            display: block;
        }

        .header-center {
            flex: 1;
            text-align: center;
            padding: 0 15px;
        }

        .org-parent {
            font-size: 14px;
            text-transform: uppercase;
            margin: 0;
        }

        .org-name {
            font-size: 16px;
            font-weight: bold;
            margin: 5px 0 0 0;
            text-transform: uppercase;
        }

        .org-address {
            font-size: 12px;
            margin-top: 5px;
            font-style: italic;
        }

        .form-name {
            font-size: 26px;
            font-weight: bold;
            margin-top: 20px;
            text-transform: uppercase;
            color: #b91c1c;
        }

        /* Màu đỏ cho tiêu đề chính */
        .header-right {
            flex: 0 0 15%;
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
            padding: 4px;
            border-radius: 4px;
        }

        /* TABLES */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 14px;
        }

        td,
        th {
            border: 1px solid #000;
            padding: 8px;
            vertical-align: middle;
        }

        /* Info Table Specifics */
        .info-label {
            font-weight: bold;
            background-color: #f3f4f6;
            width: 150px;
        }

        .info-value {
            font-weight: 500;
        }

        /* Result Table Specifics */
        .res-table th {
            background-color: #e5e7eb;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            border-bottom: 2px solid #000;
        }

        .res-name {
            font-weight: 500;
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

        /* FOOTER */
        .footer {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
        }

        .footer-col {
            text-align: center;
            width: 45%;
        }

        .footer-title {
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 5px;
            font-size: 14px;
        }

        .footer-sign-area {
            height: 120px;
            margin-top: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .signature-image {
            max-width: 250px;
            max-height: 100px;
            display: block;
            margin: 0 auto;
        }

        .footer-disclaimer {
            margin-top: 50px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            font-size: 12px;
            font-style: italic;
            text-align: center;
            color: #555;
        }

        /* Hidden metadata for verification */
        .metadata {
            display: none;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact;
            }

            .header-center {
                flex: 1;
            }
        }
    `
}

/**
 * Render header section with logo, organization info, and QR code
 */
function renderHeader(coaData: CoAData, logoUrl: string, qrCodeUrl: string): string {
    return `
        <!-- HEADER -->
        <div class="header">
            <div class="header-left"><img src="${logoUrl}" class="logo" /></div>
            <div class="header-center">
                <div class="org-parent">SỞ Y TẾ THÀNH PHỐ CẦN THƠ</div>
                <div class="org-name">TRUNG TÂM KIỂM SOÁT BỆNH TẬT (CDC)</div>
                <div class="org-address">400 Nguyễn Văn Cừ, P. An Bình, TP. Cần Thơ</div>
                <div class="form-name">KẾT QUẢ XÉT NHIỆM</div>
            </div>
            <div class="header-right"><img src="${qrCodeUrl}" class="qr-img" />
                <div class="sample-id-box">${coaData.sample.sample_id_display}</div>
            </div>
        </div>
    `
}

/**
 * Render patient information section
 */
function renderPatientInfo(coaData: CoAData, dateStr: string): string {
    return `
        <!-- INFO -->
        <div style="margin-bottom: 20px;">
            <table>
                <tr>
                    <td class="info-label">Khách hàng:</td>
                    <td class="info-value" style="text-transform: uppercase; font-size: 16px; font-weight: bold;"
                        colspan="3">${coaData.sample.client_name || 'N/A'}</td>
                </tr>
                <tr>
                    <td class="info-label">Mã mẫu:</td>
                    <td class="info-value">${coaData.sample.sample_id_display}</td>
                    <td class="info-label">Loại mẫu:</td>
                    <td class="info-value">${coaData.sample.sample_type || 'N/A'}</td>
                </tr>
                <tr>
                    <td class="info-label">Ngày nhận mẫu:</td>
                    <td class="info-value">${coaData.sample.received_date ? new Date(coaData.sample.received_date).toLocaleDateString('vi-VN') : 'N/A'}</td>
                    <td class="info-label">Ngày xét nghiệm:</td>
                    <td class="info-value">${coaData.testingDate ? new Date(coaData.testingDate).toLocaleDateString('vi-VN') : 'N/A'}</td>
                </tr>
                <tr>
                    <td class="info-label">Ngày phê duyệt:</td>
                    <td class="info-value">${dateStr}</td>
                    <td class="info-label">Bác sĩ chỉ định:</td>
                    <td class="info-value">${coaData.manualInputs?.referrer || 'N/A'}</td>
                </tr>
            </table>
        </div>
    `
}

/**
 * Render administrative information section
 */
function renderAdministrativeInfo(coaData: CoAData): string {
    return `
        <!-- ADMINISTRATIVE INFORMATION -->
        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; color: #333;">Thông tin hành chính</h3>
            <table>
                <tr>
                    <td class="info-label">Ngày sinh:</td>
                    <td class="info-value">${coaData.sample.client_dob ? new Date(coaData.sample.client_dob).toLocaleDateString('vi-VN') : 'N/A'}</td>
                    <td class="info-label">Giới tính:</td>
                    <td class="info-value">${coaData.sample.client_gender || 'N/A'}</td>
                </tr>
                <tr>
                    <td class="info-label">Địa chỉ:</td>
                    <td class="info-value" colspan="3">${coaData.sample.client_address || 'N/A'}</td>
                </tr>
                <tr>
                    <td class="info-label">Số BHYT:</td>
                    <td class="info-value" colspan="3">${coaData.sample.client_health_insurance_num || 'N/A'}</td>
                </tr>
            </table>
        </div>
    `
}

/**
 * Render sample information section
 */
function renderSampleInfo(coaData: CoAData): string {
    return `
        <!-- SAMPLE INFORMATION -->
        <div style="margin-bottom: 20px;">
            <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; color: #333;">Thông tin mẫu</h3>
            <table>
                <tr>
                    <td class="info-label">Chất lượng mẫu:</td>
                    <td class="info-value">${coaData.manualInputs?.sampleQuality || 'N/A'}</td>
                    <td class="info-label">Loại mẫu:</td>
                    <td class="info-value">${coaData.sample.sample_type || 'N/A'}</td>
                </tr>
            </table>
        </div>
    `
}

/**
 * Render test results table
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
                    <tr>
                        <td colspan="6" style="background-color: #fce7f3; font-weight: bold; color: #9d174d; text-transform: uppercase; padding-left: 15px;">
                            ${groupName}
                        </td>
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
        <!-- RESULTS -->
        <table class="res-table">
            <thead>
                <tr>
                    <th width="5%">STT</th>
                    <th width="30%">Chỉ Tiêu Xét Nghiệm</th>
                    <th width="15%">Kết Quả</th>
                    <th width="10%">Đơn Vị</th>
                    <th width="20%">Khoảng Tham Chiếu</th>
                    <th width="20%">Phương Pháp</th>
                </tr>
            </thead>
            <tbody>
                ${tbody}
            </tbody>
        </table>
    `
}

/**
 * Render footer with signatures
 */
function renderFooter(coaData: CoAData, footerDateStr: string): string {
    return `
        <!-- FOOTER -->
        <div class="footer">
            <div class="footer-col">
                <div class="footer-title">PHỤ TRÁCH XÉT NGHIỆM</div>
                <div class="footer-sign-area"></div>
                <div style="font-weight: bold;">KTV. .................................</div>
            </div>
            <div class="footer-col">
                <div style="font-style: italic; margin-bottom: 5px;">Cần Thơ, ${footerDateStr}</div>
                <div class="footer-title">LÃNH ĐẠO KHOA XÉT NGHIỆM</div>
                <div class="footer-sign-area">
                    ${coaData.approverSignature ? `<img src="${coaData.approverSignature}" alt="Chữ ký" class="signature-image" />` : ''}
                </div>
                <div style="font-weight: bold;">${coaData.approverName}</div>
            </div>
        </div>

        <div class="footer-disclaimer">
            Kết quả xét nghiệm chỉ có giá trị trên mẫu xét nghiệm tại thời điểm kiểm tra.
        </div>
    `
}

/**
 * Render hidden metadata for verification
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
