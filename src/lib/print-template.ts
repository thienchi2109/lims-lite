import { ResultWithAssay } from '@/types'

export function generatePrintTemplate(sample: any, results: ResultWithAssay[]) {
    const today = new Date().toLocaleDateString('vi-VN')
    const receivedDate = sample.received_at ? new Date(sample.received_at).toLocaleDateString('vi-VN') : '-'

    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <title>Phiếu Yêu Cầu Xét Nghiệm - ${sample.sample_id}</title>
        <style>
            body {
                font-family: 'Times New Roman', Times, serif;
                line-height: 1.5;
                color: #000;
                background: #fff;
                margin: 0;
                padding: 20px;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            .header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                border-bottom: 2px solid #000;
                padding-bottom: 20px;
            }
            .logo-section {
                width: 40%;
            }
            .company-info {
                width: 60%;
                text-align: right;
                font-size: 12px;
            }
            .title {
                text-align: center;
                text-transform: uppercase;
                font-size: 24px;
                font-weight: bold;
                margin: 30px 0;
            }
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-bottom: 30px;
            }
            .info-item {
                display: flex;
            }
            .label {
                font-weight: bold;
                width: 120px;
            }
            .value {
                flex: 1;
                border-bottom: 1px dotted #999;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            th, td {
                border: 1px solid #000;
                padding: 8px 12px;
                text-align: left;
            }
            th {
                background-color: #f0f0f0;
                font-weight: bold;
                text-align: center;
            }
            .footer {
                display: flex;
                justify-content: space-between;
                margin-top: 50px;
                text-align: center;
            }
            .signature-box {
                width: 200px;
            }
            .signature-space {
                height: 100px;
            }
            @media print {
                body { padding: 0; }
                @page { margin: 2cm; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo-section">
                    <h2 style="margin: 0;">LIMS-LITE</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">Laboratory Information Management System</p>
                </div>
                <div class="company-info">
                    <p style="margin: 0; font-weight: bold;">TRUNG TÂM XÉT NGHIỆM ABC</p>
                    <p style="margin: 0;">123 Đường Nguyễn Văn Linh, Quận 7, TP.HCM</p>
                    <p style="margin: 0;">Hotline: 1900 1234 - Email: contact@limslite.com</p>
                </div>
            </div>

            <h1 class="title">PHIẾU YÊU CẦU XÉT NGHIỆM</h1>

            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Mã mẫu:</span>
                    <span class="value">${sample.sample_id}</span>
                </div>
                <div class="info-item">
                    <span class="label">Ngày nhận:</span>
                    <span class="value">${receivedDate}</span>
                </div>
                <div class="info-item">
                    <span class="label">Khách hàng:</span>
                    <span class="value">${sample.client_name || '................................................'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Người nhận:</span>
                    <span class="value">${sample.received_by_name || '................................................'}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 50px;">STT</th>
                        <th>Tên chỉ tiêu</th>
                        <th>Phương pháp</th>
                        <th>Đơn vị tính</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map((result, index) => `
                        <tr>
                            <td style="text-align: center;">${index + 1}</td>
                            <td>${result.assay_name}</td>
                            <td>${result.method_name || '-'}</td>
                            <td>${result.assay_units || '-'}</td>
                            <td></td>
                        </tr>
                    `).join('')}
                    ${results.length === 0 ? `
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 20px;">Chưa có chỉ tiêu nào</td>
                        </tr>
                    ` : ''}
                </tbody>
            </table>

            <div class="footer">
                <div class="signature-box">
                    <p style="font-weight: bold;">Người yêu cầu</p>
                    <p style="font-style: italic; font-size: 12px;">(Ký và ghi rõ họ tên)</p>
                    <div class="signature-space"></div>
                </div>
                <div class="signature-box">
                    <p style="font-style: italic;">Ngày ..... tháng ..... năm 20...</p>
                    <p style="font-weight: bold;">Người nhận mẫu</p>
                    <p style="font-style: italic; font-size: 12px;">(Ký và ghi rõ họ tên)</p>
                    <div class="signature-space"></div>
                    <p>${sample.received_by_name || ''}</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `
}
