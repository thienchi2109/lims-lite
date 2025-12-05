import { ResultWithAssay } from '@/types'

export function generatePrintTemplate(sample: any, results: ResultWithAssay[]) {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${sample.sample_id}&margin=0`;
  const logoUrl = "https://i.postimg.cc/8zFZ52j1/cdc-logo-150.png";
  const dateStr = new Date().toLocaleDateString('vi-VN');

  // Group results by category (mocked as 'XÉT NGHIỆM' since we don't have category in ResultWithAssay)
  const testsByCategory: { [key: string]: ResultWithAssay[] } = {};
  results.forEach(result => {
    const cat = 'XÉT NGHIỆM'; // Default category
    if (!testsByCategory[cat]) testsByCategory[cat] = [];
    testsByCategory[cat].push(result);
  });

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Phiếu Chỉ Định - ${sample.sample_id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
        
        body { 
          font-family: 'Times New Roman', serif; 
          font-size: 11px; 
          color: #111;
          line-height: 1.3;
          background: #fff;
          margin: 0;
          padding: 10px;
          zoom: 0.95;
        }

        .container {
          max-width: 148mm;
          margin: 0 auto;
        }

        /* HEADER */
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 15px;
          border-bottom: 1px solid #000;
          padding-bottom: 10px;
        }
        
        .header-left {
          flex: 0 0 15%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .logo { width: 60px; height: auto; display: block; } 
        
        .header-center {
          flex: 1;
          text-align: center;
          padding: 0 10px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .org-parent { font-size: 11px; font-weight: normal; margin: 0; text-transform: uppercase; }
        .org-name { font-size: 13px; font-weight: bold; margin: 2px 0 0 0; text-transform: uppercase; color: #000; }
        .org-address { font-size: 9px; margin-top: 2px; font-style: italic; }
        .form-name { font-size: 18px; font-weight: bold; margin-top: 10px; text-transform: uppercase; color: #0056b3; }

        .header-right {
          flex: 0 0 20%;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .qr-img { width: 60px; height: 60px; margin-bottom: 4px; }
        .sample-id-box { font-family: monospace; font-size: 11px; font-weight: bold; border: 1px solid #ccc; padding: 2px 4px; border-radius: 4px; background: #f8fafc; }

        /* SECTIONS & TABLES */
        .section-box { margin-bottom: 10px; }
        .section-title { 
          font-size: 12px; 
          font-weight: 700; 
          text-transform: uppercase; 
          margin-bottom: 5px;
          color: #0056b3;
          border-bottom: 1px solid #eee;
          padding-bottom: 2px;
        }

        /* Info Table Style */
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
        .info-table td {
            border: 1px solid #000; /* Solid border for info fields */
            padding: 4px;
            vertical-align: middle;
        }
        .info-label {
            font-weight: bold;
            color: #333;
            background-color: #f9fafb; /* Light gray background for labels */
            width: 100px;
        }
        .info-value {
            font-weight: 500;
            color: #000;
        }

        /* MODERN DATA GRID TABLE */
        .test-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 5px; 
            font-size: 11px; 
            border: 1px solid #cbd5e1;
        }
        .test-table th { 
          border: 1px solid #cbd5e1; 
          padding: 5px 4px; 
          background-color: #f8fafc; 
          color: #334155;
          font-weight: 800; 
          text-transform: uppercase;
          text-align: left;
          font-size: 10px;
        }
        .test-table td { 
            border: 1px solid #e2e8f0; 
            padding: 5px 4px; 
            vertical-align: middle; 
            color: #1e293b;
        }
        .cat-row td { 
          background-color: #f0f9ff; 
          font-weight: 700; 
          text-align: left; 
          padding-left: 8px;
          color: #dc2626; /* RED COLOR FOR CATEGORY AS REQUESTED */
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .center-text { text-align: center; }
        .checkbox-cell {
            font-size: 14px;
            color: #94a3b8;
            line-height: 1;
            text-align: center;
        }

        /* FOOTER */
        .footer {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
          page-break-inside: avoid;
        }
        .footer-col { text-align: center; width: 45%; }
        .footer-title { font-weight: bold; text-transform: uppercase; margin-top: 5px; font-size: 11px; }
        .footer-sign-area { height: 60px; margin-top: 5px; }
        .footer-info {
            margin-top: 15px;
            border-top: 1px solid #ccc;
            padding-top: 5px;
            font-size: 9px;
            display: flex;
            justify-content: space-between;
            color: #666;
        }
        
        @media print {
          @page { margin: 5mm; size: A5 portrait; }
          body { -webkit-print-color-adjust: exact; }
          .header-center { flex: 1; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        <!-- HEADER -->
        <div class="header">
          <div class="header-left">
            <img src="${logoUrl}" class="logo" alt="Logo" />
          </div>
          <div class="header-center">
            <div class="org-parent">SỞ Y TẾ THÀNH PHỐ CẦN THƠ</div>
            <div class="org-name">TRUNG TÂM KIỂM SOÁT BỆNH TẬT (CDC)</div>
            <div class="org-address">400 Nguyễn Văn Cừ, P. An Bình, TP. Cần Thơ</div>
            <div class="form-name">PHIẾU CHỈ ĐỊNH XÉT NGHIỆM</div>
          </div>
          <div class="header-right">
            <img src="${qrCodeUrl}" class="qr-img" alt="QR Code" />
            <div class="sample-id-box">${sample.sample_id}</div>
          </div>
        </div>

        <!-- I. INFO TABLE (Patient & Clinical) -->
        <div class="section-box">
          <div class="section-title">I. Thông Tin Hành Chính & Lâm Sàng</div>
          <table class="info-table">
            <tbody>
                <tr>
                    <td class="info-label">Họ và tên:</td>
                    <td class="info-value" style="text-transform: uppercase; font-weight: bold; font-size: 13px;" colspan="3">${sample.client_name || ''}</td>
                </tr>
                <tr>
                    <td class="info-label">Năm sinh:</td>
                    <td class="info-value">......................</td>
                    <td class="info-label">Giới tính:</td>
                    <td class="info-value">......................</td>
                </tr>
                <tr>
                    <td class="info-label">Địa chỉ:</td>
                    <td class="info-value" colspan="3">................................................................................................</td>
                </tr>
                <tr>
                    <td class="info-label">Số BHYT:</td>
                    <td class="info-value">................................</td>
                    <td class="info-label">Hạn sử dụng:</td>
                    <td class="info-value">................................</td>
                </tr>
                <tr>
                    <td class="info-label">Điện thoại:</td>
                    <td class="info-value" colspan="3">................................</td>
                </tr>
                <tr>
                    <td class="info-label">Chẩn đoán:</td>
                    <td class="info-value" colspan="3">................................................................................................</td>
                </tr>
                <tr>
                    <td class="info-label">Bác sĩ chỉ định:</td>
                    <td class="info-value" colspan="3">................................</td>
                </tr>
            </tbody>
          </table>
        </div>

        <!-- II. SAMPLE & TIME INFO (Bổ sung theo yêu cầu) -->
        <div class="section-box">
            <div class="section-title">II. Thông Tin Mẫu & Thời Gian</div>
            <table class="info-table">
                <tbody>
                    <tr>
                        <td class="info-label">Loại mẫu:</td>
                        <td class="info-value">......................</td>
                        <td class="info-label">Ngày lấy mẫu:</td>
                        <td class="info-value">${sample.received_at ? new Date(sample.received_at).toLocaleDateString('vi-VN') : '......................'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Giờ lấy mẫu:</td>
                        <td class="info-value">......................</td>
                        <td class="info-label">Người lấy mẫu:</td>
                        <td class="info-value">......................</td>
                    </tr>
                    <tr>
                        <td class="info-label">Giờ nhận mẫu:</td>
                        <td class="info-value">......................</td>
                        <td class="info-label">Người nhận mẫu:</td>
                        <td class="info-value">${sample.received_by_name || '......................'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- III. MODERN DATA GRID TABLE -->
        <div class="section-box">
          <div class="section-title">III. Chỉ Định Xét Nghiệm</div>
          <table class="test-table">
            <thead>
              <tr>
                <th width="5%" class="center-text">STT</th>
                <th width="5%" class="center-text">Chọn</th>
                <th width="15%" class="center-text">Mã XN</th>
                <th width="45%">Tên Xét Nghiệm / Protocol</th>
                <th width="30%">Ghi Chú</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(testsByCategory).map(([category, tests], catIndex) => `
                <tr class="cat-row">
                  <td colspan="5">${category}</td>
                </tr>
                ${tests.map((test, index) => `
                  <tr>
                    <td class="center-text">${index + 1}</td>
                    <td class="checkbox-cell">☐</td>
                    <td class="center-text" style="font-weight:bold;">${test.assay_name}</td> 
                    <td style="font-weight: 500;">${test.assay_name}</td>
                    <td></td>
                  </tr>
                `).join('')}
              `).join('')}
              
              ${results.length === 0 ? `
                <tr><td colspan="5" style="text-align:center; padding: 15px; color: #64748b; font-style: italic;">Chưa có chỉ định nào</td></tr>
              ` : ''}
            </tbody>
          </table>
        </div>

        <!-- FOOTER (Cập nhật theo mẫu) -->
        <div class="footer">
          <div class="footer-col">
            <div style="font-style: italic; font-size: 10px; margin-bottom: 3px;">Ngày ..... tháng ..... năm .....</div>
            <div class="footer-title">KHÁCH HÀNG YÊU CẦU</div>
            <div class="footer-sign-area"></div>
            <div style="font-size: 10px;">(Ký và ghi rõ họ tên)</div>
          </div>
          <div class="footer-col">
            <div style="font-style: italic; font-size: 10px; margin-bottom: 3px;">Cần Thơ, ngày ${dateStr.split('/')[0]} tháng ${dateStr.split('/')[1]} năm ${dateStr.split('/')[2]}</div>
            <div class="footer-title">Bác Sĩ Chỉ Định</div>
            <div class="footer-sign-area"></div>
            <div style="font-weight: bold; font-size: 11px;">(Ký và ghi rõ họ tên)</div>
          </div>
        </div>

        <!-- FOOTER INFO (Định danh cuối trang) -->
        <div class="footer-info">
            <div>PL2.1.CDC.STLM</div>
            <div>Trang: 1/1</div>
            <div>Ngày ban hành: ....................</div>
        </div>

      </div>
    </body>
    </html>
  `;
}
