import type { Client, ResultWithAssay, SampleWithUser } from '@/types'

type SampleForPrint = SampleWithUser & {
  client?: Pick<
    Client,
    'id' | 'name' | 'date_of_birth' | 'gender' | 'phone' | 'address' | 'health_insurance_num'
  > | null
}

export function generatePrintTemplate(sample: SampleForPrint, results: ResultWithAssay[]) {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${sample.sample_id}&margin=0`;
  const logoUrl = "https://i.postimg.cc/8zFZ52j1/cdc-logo-150.png";
  const dateStr = new Date().toLocaleDateString('vi-VN');

  const client = sample.client ?? null
  const clientName = client?.name || sample.client_name || ''
  const birthYear = client?.date_of_birth
    ? (() => {
      const year = new Date(client.date_of_birth).getFullYear()
      return Number.isFinite(year) ? String(year) : ''
    })()
    : ''
  const gender = client?.gender || ''
  const address = client?.address || ''
  const phone = client?.phone || ''
  const healthInsuranceNum = client?.health_insurance_num || ''
  const sampleType = sample.type || ''

  // Group results by category (Lab Specialty)
  const testsByCategory: { [key: string]: ResultWithAssay[] } = {};
  const categoryOrder: { [key: string]: number } = {};

  results.forEach(result => {
    const cat = result.lab_specialty_name || 'KHÁC';
    if (!testsByCategory[cat]) {
      testsByCategory[cat] = [];
      categoryOrder[cat] = result.lab_specialty_order ?? 9999;
    }
    testsByCategory[cat].push(result);
  });

  // Sort categories by order
  const sortedCategories = Object.keys(testsByCategory).sort((a, b) => {
    const orderA = categoryOrder[a];
    const orderB = categoryOrder[b];
    return orderA - orderB;
  });

  // Flatten results for sequential numbering
  const displayResults: ResultWithAssay[] = [];
  sortedCategories.forEach(cat => {
    testsByCategory[cat].sort((a, b) => (a.assay_name || '').localeCompare(b.assay_name || ''));
    displayResults.push(...testsByCategory[cat]);
  });

  /* Logic for Portal URL */
  const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '');
  const portalUrl = `${origin}/coa/access`;
  const portalQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(portalUrl)}&margin=0`;

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
          font-size: 13px; 
          color: #111;
          line-height: 1.3;
          background: #fff;
          margin: 0;
          padding: 0;
        }

        .container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          background: white;
        }

        /* HEADER */
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 15px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        
        .header-left {
          flex: 0 0 15%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .logo { width: 80px; height: auto; display: block; } 
        
        .header-center {
          flex: 1;
          text-align: center;
          padding: 0 10px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .org-parent { font-size: 13px; font-weight: normal; margin: 0; text-transform: uppercase; }
        .org-name { font-size: 15px; font-weight: bold; margin: 4px 0 0 0; text-transform: uppercase; color: #000; }
        .org-address { font-size: 12px; margin-top: 4px; font-style: italic; }
        .form-name { font-size: 22px; font-weight: bold; margin-top: 10px; text-transform: uppercase; color: #0056b3; }

        .header-right {
          flex: 0 0 15%;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .qr-img { width: 70px; height: 70px; margin-bottom: 5px; }
        .sample-id-box { font-family: monospace; font-size: 12px; font-weight: bold; border: 1px solid #ccc; padding: 2px 6px; border-radius: 4px; background: #f8fafc; }

        /* SECTIONS & TABLES */
        .section-box { margin-bottom: 15px; }
        .section-title { 
          font-size: 14px; 
          font-weight: 700; 
          text-transform: uppercase; 
          margin-bottom: 5px;
          color: #0056b3;
          border-bottom: 1px dotted #ccc;
          padding-bottom: 2px;
        }

        /* Info Table Style */
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 13px; }
        .info-table td {
            border: 1px solid #ccc;
            padding: 6px 8px;
            vertical-align: middle;
        }
        .info-label {
            font-weight: bold;
            color: #333;
            background-color: #f9fafb;
            white-space: nowrap;
            width: 1%; /* Shrink to fit content */
        }
        .info-value {
            font-weight: 500;
            color: #000;
        }
        .uppercase { text-transform: uppercase; }

        /* MODERN DATA GRID TABLE */
        .test-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 5px; 
            font-size: 13px; 
            border: 1px solid #000;
        }
        .test-table th { 
          border: 1px solid #000; 
          padding: 8px; 
          background-color: #f1f5f9; 
          color: #000;
          font-weight: bold; 
          text-transform: uppercase;
          text-align: left;
          font-size: 12px;
        }
        .test-table td { 
            border: 1px solid #000; 
            padding: 6px 8px; 
            vertical-align: middle; 
            color: #000;
        }
        .cat-row td { 
          background-color: #f0f9ff; 
          font-weight: bold; 
          text-align: left; 
          padding-left: 12px;
          color: #dc2626;
          text-transform: uppercase;
          font-size: 13px;
        }
        .center-text { text-align: center; }
        .checkbox-cell {
            font-size: 16px;
            color: #000;
            line-height: 1;
            text-align: center;
        }

        /* PORTAL GUIDE BOX */
        .portal-guide-box {
            margin-top: 25px;
            border: 2px dashed #0056b3;
            border-radius: 8px;
            padding: 10px 15px;
            display: flex;
            align-items: center;
            gap: 20px;
            background-color: #f8fafc;
            page-break-inside: avoid;
        }
        .portal-qr img {
            width: 80px;
            height: 80px;
            display: block;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .portal-text {
            flex: 1;
        }
        .portal-title {
            font-weight: 700;
            color: #0056b3;
            text-transform: uppercase;
            margin-bottom: 5px;
            font-size: 13px;
        }
        .portal-guide-box ul {
            margin: 0;
            padding-left: 20px;
            font-size: 12px;
            color: #333;
        }
        .portal-guide-box li {
            margin-bottom: 2px;
        }

        /* FOOTER */
        .footer {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
          page-break-inside: avoid;
        }
        .footer-col { text-align: center; width: 40%; }
        .footer-title { font-weight: bold; text-transform: uppercase; margin-top: 5px; font-size: 13px; }
        .footer-sign-area { height: 80px; margin-top: 10px; }
        .footer-info {
            margin-top: 20px;
            border-top: 1px solid #ccc;
            padding-top: 5px;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            color: #666;
        }
        
        @media print {
          @page { margin: 15mm; size: A4 portrait; }
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
          <div class="section-title">I. Thông Tin Hành Chính</div>
          <table class="info-table">
            <colgroup>
                <col style="width: 12%">
                <col style="width: 38%">
                <col style="width: 12%">
                <col style="width: 13%">
                <col style="width: 12%">
                <col style="width: 13%">
            </colgroup>
            <tbody>
                <tr>
                    <td class="info-label">Họ và tên:</td>
                    <td class="info-value uppercase" style="font-weight: 800; font-size: 14px;">${clientName}</td>
                    <td class="info-label">Năm sinh:</td>
                    <td class="info-value">${birthYear || '............'}</td>
                    <td class="info-label">Giới tính:</td>
                    <td class="info-value">${gender || '............'}</td>
                </tr>
                <tr>
                    <td class="info-label">Địa chỉ:</td>
                    <td class="info-value" colspan="3">${address || '....................................................................................'}</td>
                    <td class="info-label">Điện thoại:</td>
                    <td class="info-value">${phone || '............'}</td>
                </tr>
                 <tr>
                    <td class="info-label">Bác sĩ CĐ:</td>
                    <td class="info-value" colspan="3">....................................................................................</td>
                    <td class="info-label">Số BHYT:</td>
                    <td class="info-value">${healthInsuranceNum || '............'}</td>
                </tr>
                <tr>
                    <td class="info-label">Chẩn đoán:</td>
                    <td class="info-value" colspan="5">..........................................................................................................................................</td>
                </tr>
            </tbody>
          </table>
        </div>

        <!-- II. SAMPLE INFO -->
        <div class="section-box">
            <div class="section-title">II. Thông Tin Mẫu</div>
            <table class="info-table">
                <colgroup>
                    <col style="width: 12%">
                    <col style="width: 25%">
                    <col style="width: 12%">
                    <col style="width: 20%">
                    <col style="width: 12%">
                    <col style="width: 19%">
                </colgroup>
                <tbody>
                    <tr>
                        <td class="info-label">Loại mẫu:</td>
                        <td class="info-value">${sampleType || '....................'}</td>
                        <td class="info-label">Thời gian lấy:</td>
                        <td class="info-value">..../..../....... ...:</td>
                        <td class="info-label">Người lấy:</td>
                        <td class="info-value">................</td>
                    </tr>
                    <tr>
                         <td class="info-label">Thời gian nhận:</td>
                        <td class="info-value">${sample.received_at ? new Date(sample.received_at).toLocaleDateString('vi-VN') + ' ' + new Date(sample.received_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '..../..../....... ...:'}</td>
                        <td class="info-label">Người nhận:</td>
                        <td class="info-value" colspan="3">${sample.received_by_name || '...................................................'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- III. TESTS -->
        <div class="section-box" style="flex: 1;">
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
              ${sortedCategories.map((category) => `
                <tr class="cat-row">
                  <td colspan="5">${category}</td>
                </tr>
                ${testsByCategory[category].map((test, index) => `
                  <tr>
                    <td class="center-text">${displayResults.indexOf(test) + 1}</td>
                    <td class="checkbox-cell">☐</td>
                    <td class="center-text" style="font-weight:bold;">${test.assay_name}</td> 
                    <td style="font-weight: 500;">${test.assay_name}</td>
                    <td></td>
                  </tr>
                `).join('')}
              `).join('')}
              
              ${results.length === 0 ? `
                <tr><td colspan="5" style="text-align:center; padding: 20px; color: #64748b; font-style: italic; font-size: 13px;">Chưa có chỉ định nào</td></tr>
              ` : ''}
            </tbody>
          </table>
        </div>

        <!-- FOOTER -->
        <div class="footer">
          <div class="footer-col">
            <div style="font-style: italic; font-size: 12px; margin-bottom: 5px;">Ngày ..... tháng ..... năm .....</div>
            <div class="footer-title">KHÁCH HÀNG YÊU CẦU</div>
            <div class="footer-sign-area"></div>
            <div style="font-size: 12px;">(Ký và ghi rõ họ tên)</div>
          </div>
          <div class="footer-col">
            <div style="font-style: italic; font-size: 12px; margin-bottom: 5px;">Cần Thơ, ngày ${dateStr.split('/')[0]} tháng ${dateStr.split('/')[1]} năm ${dateStr.split('/')[2]}</div>
            <div class="footer-title">Bác Sĩ Chỉ Định</div>
            <div class="footer-sign-area"></div>
            <div style="font-weight: bold; font-size: 12px;">(Ký và ghi rõ họ tên)</div>
          </div>
        </div>

        <!-- PORTAL ACCESS GUIDE -->
        <div class="portal-guide-box">
             <div class="portal-qr">
                <img src="${portalQrUrl}" alt="Portal QR" />
             </div>
             <div class="portal-text">
                <div class="portal-title">TRA CỨU KẾT QUẢ TRỰC TUYẾN</div>
                <ul>
                    <li>Quét mã QR bằng Camera điện thoại</li>
                    <li>Nhập số điện thoại đã đăng ký để xem và tải kết quả</li>
                    <li>Hoặc truy cập: <span style="font-family: monospace; font-size: 11px;">${portalUrl}</span></li>
                </ul>
             </div>
        </div>

        <div class="footer-info">
            <div>PL2.1.CDC.STLM</div>
            <div>Trang: 1/1</div>
            <div>Ngày ban hành: ${dateStr}</div>
        </div>

      </div>
    </body>
    </html>
  `;
}
