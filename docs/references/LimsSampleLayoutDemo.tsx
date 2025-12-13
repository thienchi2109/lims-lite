import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Beaker, 
  FileText, 
  Activity, 
  Calendar, 
  User, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Microscope,
  X,
  Plus,
  FlaskConical,
  Dna,
  Printer
} from 'lucide-react';

// --- Types ---
interface Test {
  id: string;
  code: string;
  name: string;
  status: 'Chờ xử lý' | 'Hoàn tất' | 'Đang thực hiện';
  category?: string;
  price?: number; 
}

interface Sample {
  id: string;
  sampleId: string;
  patientName: string;
  dob?: string; 
  gender?: string; 
  address?: string; 
  phoneNumber?: string; 
  insuranceNumber?: string; 
  insuranceExpiry?: string; 
  collectionDate: string;
  type: string;
  priority: 'Thường' | 'Cấp cứu' | 'Khẩn';
  status: 'Đã đăng ký' | 'Đã nhận mẫu' | 'Đang thực hiện' | 'Hoàn tất';
  tests: Test[];
  doctorName?: string; 
  diagnosis?: string; 
}

// --- Mock Data (VIETNAMESE) ---
const MOCK_SAMPLES: Sample[] = [
  {
    id: '1',
    sampleId: 'SMP-2023-001',
    patientName: 'NGUYỄN VĂN A',
    dob: '1985',
    gender: 'Nam',
    address: 'Ninh Kiều, Cần Thơ',
    phoneNumber: '0909123456',
    insuranceNumber: 'DN4790012345678',
    insuranceExpiry: '31/12/2024',
    collectionDate: '25/10/2023 08:30',
    type: 'Máu (Toàn phần)',
    priority: 'Thường',
    status: 'Đang thực hiện',
    doctorName: 'BS. Lê Minh',
    diagnosis: 'Sốt xuất huyết Dengue (nghi ngờ)',
    tests: [
      { id: 't1', code: 'CBC', name: 'Tổng phân tích tế bào máu', status: 'Hoàn tất', category: 'HUYẾT HỌC', price: 150000 },
      { id: 't2', code: 'GLU', name: 'Glucose lúc đói', status: 'Đang thực hiện', category: 'SINH HÓA', price: 40000 },
      { id: 't3', code: 'HBA1C', name: 'HbA1c', status: 'Chờ xử lý', category: 'SINH HÓA', price: 120000 },
    ]
  },
  {
    id: '2',
    sampleId: 'SMP-2023-002',
    patientName: 'LÊ THỊ B',
    dob: '1990',
    gender: 'Nữ',
    address: 'Cái Răng, Cần Thơ',
    phoneNumber: '0918765432',
    insuranceNumber: 'GD4790087654321',
    insuranceExpiry: '30/06/2024',
    collectionDate: '25/10/2023 09:15',
    type: 'Nước tiểu',
    priority: 'Cấp cứu',
    status: 'Đã nhận mẫu',
    doctorName: 'BS. Trần Hùng',
    diagnosis: 'Nhiễm trùng đường tiết niệu',
    tests: [
      { id: 't4', code: 'UA', name: 'Tổng phân tích nước tiểu', status: 'Chờ xử lý', category: 'SINH HÓA', price: 60000 },
    ]
  },
  {
    id: '3',
    sampleId: 'SMP-2023-003',
    patientName: 'TRẦN VĂN C',
    dob: '1978',
    gender: 'Nam',
    address: 'Bình Thủy, Cần Thơ',
    phoneNumber: '0939112233',
    collectionDate: '25/10/2023 10:00',
    type: 'Huyết thanh',
    priority: 'Thường',
    status: 'Đã đăng ký',
    doctorName: 'BS. Nguyễn Lan',
    diagnosis: 'Khám sức khỏe tổng quát',
    tests: [] 
  },
  {
    id: '4',
    sampleId: 'SMP-2023-004',
    patientName: 'PHẠM THỊ D',
    collectionDate: '25/10/2023 10:45',
    type: 'Máu (EDTA)',
    priority: 'Khẩn',
    status: 'Hoàn tất',
    tests: [
      { id: 't5', code: 'CRP', name: 'CRP định lượng', status: 'Hoàn tất', category: 'MIỄN DỊCH', price: 80000 },
      { id: 't6', code: 'ESR', name: 'Tốc độ máu lắng (VS)', status: 'Hoàn tất', category: 'HUYẾT HỌC', price: 50000 },
    ]
  },
  {
    id: '5',
    sampleId: 'SMP-2023-005',
    patientName: 'HOÀNG VĂN E',
    collectionDate: '25/10/2023 11:00',
    type: 'Huyết tương',
    priority: 'Thường',
    status: 'Đã đăng ký',
    tests: []
  },
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: `dummy-${i}`,
    sampleId: `SMP-2023-0${10 + i}`,
    patientName: `BỆNH NHÂN MẪU ${i + 1}`,
    collectionDate: '26/10/2023 07:00',
    type: 'N/A',
    priority: 'Thường' as const,
    status: 'Đã đăng ký' as const,
    tests: []
  }))
];

// --- TEST CATALOG MOCK DATA (VIETNAMESE) ---
const TEST_CATALOG = [
    { code: 'CBC', name: 'Tổng phân tích tế bào máu', category: 'HUYẾT HỌC', price: 150000 },
    { code: 'ESR', name: 'Tốc độ máu lắng (VS)', category: 'HUYẾT HỌC', price: 50000 },
    { code: 'GLU', name: 'Glucose lúc đói', category: 'SINH HÓA', price: 40000 },
    { code: 'HBA1C', name: 'HbA1c', category: 'SINH HÓA', price: 120000 },
    { code: 'LIPID', name: 'Bộ mỡ máu (Lipid Profile)', category: 'SINH HÓA', price: 200000 },
    { code: 'LFT', name: 'Chức năng gan (AST/ALT/GGT)', category: 'SINH HÓA', price: 180000 },
    { code: 'KFT', name: 'Chức năng thận (Urea/Cre)', category: 'SINH HÓA', price: 160000 },
    { code: 'CRP', name: 'CRP định lượng', category: 'MIỄN DỊCH', price: 80000 },
    { code: 'TSH', name: 'TSH (Tuyến giáp)', category: 'MIỄN DỊCH', price: 100000 },
    { code: 'UA', name: 'Tổng phân tích nước tiểu', category: 'SINH HÓA', price: 60000 },
];

// --- PRINT TEMPLATE GENERATOR ---
const generatePrintTemplate = (sample: Sample) => {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${sample.sampleId}&margin=0`;
  const logoUrl = "https://i.postimg.cc/8zFZ52j1/cdc-logo-150.png";
  const dateStr = new Date().toLocaleDateString('vi-VN');
  
  const testsByCategory: {[key: string]: Test[]} = {};
  sample.tests.forEach(test => {
    const cat = test.category || 'KHÁC';
    if (!testsByCategory[cat]) testsByCategory[cat] = [];
    testsByCategory[cat].push(test);
  });

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Phiếu Chỉ Định - ${sample.sampleId}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
        
        body { 
          font-family: 'Times New Roman', serif; 
          font-size: 15px; 
          color: #111;
          line-height: 1.4;
          background: #fff;
          margin: 0;
          padding: 20px;
        }

        .container {
          max-width: 210mm;
          margin: 0 auto;
        }

        /* HEADER */
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 25px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        
        .header-left {
          flex: 0 0 15%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .logo { width: 100px; height: auto; display: block; } 
        
        .header-center {
          flex: 1;
          text-align: center;
          padding: 0 15px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .org-parent { font-size: 16px; font-weight: normal; margin: 0; text-transform: uppercase; }
        .org-name { font-size: 18px; font-weight: bold; margin: 5px 0 0 0; text-transform: uppercase; color: #000; }
        .org-address { font-size: 13px; margin-top: 5px; font-style: italic; }
        .form-name { font-size: 28px; font-weight: bold; margin-top: 20px; text-transform: uppercase; color: #0056b3; }

        .header-right {
          flex: 0 0 20%;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .qr-img { width: 90px; height: 90px; margin-bottom: 8px; }
        .sample-id-box { font-family: monospace; font-size: 14px; font-weight: bold; border: 1px solid #ccc; padding: 4px 8px; border-radius: 4px; background: #f8fafc; }

        /* SECTIONS & TABLES */
        .section-box { margin-bottom: 20px; }
        .section-title { 
          font-size: 16px; 
          font-weight: 700; 
          text-transform: uppercase; 
          margin-bottom: 12px;
          color: #0056b3;
          border-bottom: 2px solid #eee;
          padding-bottom: 5px;
        }

        /* Info Table Style */
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 15px; }
        .info-table td {
            border: 1px solid #000; /* Solid border for info fields */
            padding: 8px;
            vertical-align: middle;
        }
        .info-label {
            font-weight: bold;
            color: #333;
            background-color: #f9fafb; /* Light gray background for labels */
            width: 140px;
        }
        .info-value {
            font-weight: 500;
            color: #000;
        }

        /* MODERN DATA GRID TABLE */
        .test-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
            font-size: 14px; 
            border: 1px solid #cbd5e1;
        }
        .test-table th { 
          border: 1px solid #cbd5e1; 
          padding: 10px 8px; 
          background-color: #f8fafc; 
          color: #334155;
          font-weight: 800; 
          text-transform: uppercase;
          text-align: left;
          font-size: 13px;
        }
        .test-table td { 
            border: 1px solid #e2e8f0; 
            padding: 10px 8px; 
            vertical-align: middle; 
            color: #1e293b;
        }
        .cat-row td { 
          background-color: #f0f9ff; 
          font-weight: 700; 
          text-align: left; 
          padding-left: 12px;
          color: #dc2626; /* RED COLOR FOR CATEGORY AS REQUESTED */
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .center-text { text-align: center; }
        .checkbox-cell {
            font-size: 18px;
            color: #94a3b8;
            line-height: 1;
            text-align: center;
        }

        /* FOOTER */
        .footer {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          page-break-inside: avoid;
        }
        .footer-col { text-align: center; width: 40%; }
        .footer-title { font-weight: bold; text-transform: uppercase; margin-top: 5px; font-size: 15px; }
        .footer-sign-area { height: 100px; margin-top: 10px; }
        .footer-info {
            margin-top: 30px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            color: #666;
        }
        
        @media print {
          @page { margin: 15mm; size: A4; }
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
            <div class="sample-id-box">${sample.sampleId}</div>
          </div>
        </div>

        <!-- I. INFO TABLE (Patient & Clinical) -->
        <div class="section-box">
          <div class="section-title">I. Thông Tin Hành Chính & Lâm Sàng</div>
          <table class="info-table">
            <tbody>
                <tr>
                    <td class="info-label">Họ và tên:</td>
                    <td class="info-value" style="text-transform: uppercase; font-weight: bold; font-size: 16px;" colspan="3">${sample.patientName}</td>
                </tr>
                <tr>
                    <td class="info-label">Năm sinh:</td>
                    <td class="info-value">${sample.dob || ''}</td>
                    <td class="info-label">Giới tính:</td>
                    <td class="info-value">${sample.gender || ''}</td>
                </tr>
                <tr>
                    <td class="info-label">Địa chỉ:</td>
                    <td class="info-value" colspan="3">${sample.address || ''}</td>
                </tr>
                <tr>
                    <td class="info-label">Số BHYT:</td>
                    <td class="info-value">${sample.insuranceNumber || '................................'}</td>
                    <td class="info-label">Hạn sử dụng:</td>
                    <td class="info-value">${sample.insuranceExpiry || '................................'}</td>
                </tr>
                <tr>
                    <td class="info-label">Điện thoại:</td>
                    <td class="info-value" colspan="3">${sample.phoneNumber || ''}</td>
                </tr>
                <tr>
                    <td class="info-label">Chẩn đoán:</td>
                    <td class="info-value" colspan="3">${sample.diagnosis || ''}</td>
                </tr>
                <tr>
                    <td class="info-label">Bác sĩ chỉ định:</td>
                    <td class="info-value" colspan="3">${sample.doctorName || '................................'}</td>
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
                        <td class="info-value">${sample.type}</td>
                        <td class="info-label">Ngày lấy mẫu:</td>
                        <td class="info-value">${sample.collectionDate.split(' ')[0]}</td>
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
                        <td class="info-value">......................</td>
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
                    <td class="center-text" style="font-weight:bold;">${test.code}</td>
                    <td style="font-weight: 500;">${test.name}</td>
                    <td></td>
                  </tr>
                `).join('')}
              `).join('')}
              
              ${sample.tests.length === 0 ? `
                <tr><td colspan="5" style="text-align:center; padding: 25px; color: #64748b; font-style: italic;">Chưa có chỉ định nào</td></tr>
              ` : ''}
            </tbody>
          </table>
        </div>

        <!-- FOOTER (Cập nhật theo mẫu) -->
        <div class="footer">
          <div class="footer-col">
            <div style="font-style: italic; font-size: 14px; margin-bottom: 5px;">Ngày ..... tháng ..... năm .....</div>
            <div class="footer-title">KHÁCH HÀNG YÊU CẦU</div>
            <div class="footer-sign-area"></div>
            <div>(Ký và ghi rõ họ tên)</div>
          </div>
          <div class="footer-col">
            <div style="font-style: italic; font-size: 14px; margin-bottom: 5px;">Cần Thơ, ngày ${dateStr.split('/')[0]} tháng ${dateStr.split('/')[1]} năm ${dateStr.split('/')[2]}</div>
            <div class="footer-title">Bác Sĩ Chỉ Định</div>
            <div class="footer-sign-area"></div>
            <div style="font-weight: bold; font-size: 15px;">${sample.doctorName || '(Ký và ghi rõ họ tên)'}</div>
          </div>
        </div>

        <!-- FOOTER INFO (Định danh cuối trang) -->
        <div class="footer-info">
            <div>PL2.1.CDC.STLM</div>
            <div>Trang: 1/1</div>
            <div>Ngày ban hành: ....................</div>
        </div>

      </div>
      <script>
        window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
      </script>
    </body>
    </html>
  `;
};

const LimsSampleLayout = () => {
  const [samples, setSamples] = useState<Sample[]>(MOCK_SAMPLES);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(MOCK_SAMPLES[0].id);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const selectedSample = samples.find(s => s.id === selectedSampleId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Hoàn tất': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Đang thực hiện': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Đã nhận mẫu': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Đã đăng ký': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'Cấp cứu' || priority === 'Khẩn') return 'text-red-600 font-semibold';
    return 'text-slate-600';
  };

  const handleAddTests = (newTests: any[]) => {
      if (!selectedSampleId) return;

      const formattedTests: Test[] = newTests.map((t, idx) => ({
          id: `new-${Date.now()}-${idx}`,
          code: t.code,
          name: t.name,
          status: 'Chờ xử lý',
          category: t.category,
          price: t.price
      }));

      setSamples(prev => prev.map(s => {
          if (s.id === selectedSampleId) {
              return { ...s, tests: [...s.tests, ...formattedTests] };
          }
          return s;
      }));
      setIsTestModalOpen(false);
  };

  const handlePrintOrder = () => {
    if (!selectedSample) return;
    const printContent = generatePrintTemplate(selectedSample);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      
      {/* --- TOP ROW: Data Grid --- */}
      <div className="h-1/2 flex flex-col bg-white border-b border-slate-300 shadow-sm z-10">
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Beaker className="w-5 h-5 text-indigo-600" />
              Quản Lý Mẫu Xét Nghiệm
            </h2>
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full border border-slate-200">
              {samples.length} Bản ghi
            </span>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm mã mẫu, bệnh nhân..." 
                className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
            </div>
            <button className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">Mã Mẫu</th>
                <th className="px-4 py-3 border-b border-slate-200">Tên Bệnh Nhân</th>
                <th className="px-4 py-3 border-b border-slate-200">Loại Mẫu</th>
                <th className="px-4 py-3 border-b border-slate-200">Ngày Nhận</th>
                <th className="px-4 py-3 border-b border-slate-200">Độ Khẩn</th>
                <th className="px-4 py-3 border-b border-slate-200">Trạng Thái</th>
                <th className="px-4 py-3 border-b border-slate-200 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {samples.map((sample) => (
                <tr 
                  key={sample.id}
                  onClick={() => setSelectedSampleId(sample.id)}
                  className={`
                    cursor-pointer transition-colors duration-150
                    ${selectedSampleId === sample.id ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'}
                  `}
                >
                  <td className="px-4 py-2.5 font-medium text-indigo-600">{sample.sampleId}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{sample.patientName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{sample.type}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{sample.collectionDate}</td>
                  <td className={`px-4 py-2.5 text-xs ${getPriorityColor(sample.priority)}`}>
                    {sample.priority}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(sample.status)}`}>
                      {sample.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-400">
                    <MoreHorizontal className="w-4 h-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- BOTTOM ROW: Split View --- */}
      <div className="h-1/2 flex flex-row bg-slate-50">
        
        {/* LEFT PANEL */}
        <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Chi Tiết Mẫu
            </h3>
            {selectedSample && (
               <button className="text-xs text-indigo-600 hover:underline">Chỉnh Sửa</button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {selectedSample ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <DetailItem label="Mã Mẫu (ID)" value={selectedSample.sampleId} highlight />
                <DetailItem label="Trạng Thái" value={selectedSample.status} isBadge badgeColor={getStatusColor(selectedSample.status)} />
                
                <div className="col-span-2 border-b border-slate-100 my-1"></div>
                
                <DetailItem label="Họ Tên" value={selectedSample.patientName} icon={<User className="w-3.5 h-3.5" />} />
                <DetailItem label="Năm Sinh / Giới Tính" value={`${selectedSample.dob || 'N/A'} - ${selectedSample.gender || 'N/A'}`} icon={<Calendar className="w-3.5 h-3.5" />} />
                
                {/* NEW FIELDS DISPLAY */}
                <DetailItem label="Điện Thoại" value={selectedSample.phoneNumber || 'N/A'} />
                <DetailItem label="Số BHYT" value={selectedSample.insuranceNumber || 'N/A'} />
                
                <div className="col-span-2 border-b border-slate-100 my-1"></div>
                
                <DetailItem label="Loại Mẫu" value={selectedSample.type} icon={<Beaker className="w-3.5 h-3.5" />} />
                <DetailItem label="Ngày Lấy Mẫu" value={selectedSample.collectionDate} icon={<Calendar className="w-3.5 h-3.5" />} />
                
                <div className="col-span-2 mt-2">
                   <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Chẩn Đoán Lâm Sàng</p>
                   <p className="text-sm text-slate-700">{selectedSample.diagnosis || 'Chưa có ghi nhận'}</p>
                </div>
              </div>
            ) : (
              <EmptyState message="Chọn một mẫu để xem chi tiết" />
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-1/2 flex flex-col bg-slate-50/50">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              Chỉ Định Xét Nghiệm
            </h3>
            {selectedSample && (
              <div className="flex gap-2">
                <button
                  onClick={handlePrintOrder}
                  disabled={selectedSample.tests.length === 0}
                  className={`
                    text-xs px-3 py-1.5 rounded transition-colors shadow-sm flex items-center gap-1 border
                    ${selectedSample.tests.length === 0 
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-indigo-600'}
                  `}
                  title="Xuất Phiếu Chỉ Định"
                >
                  <Printer className="w-3 h-3" /> Xuất Phiếu
                </button>

                <button 
                  onClick={() => setIsTestModalOpen(true)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Thêm Chỉ Định
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!selectedSample ? (
              <EmptyState message="Chọn một mẫu để xem các chỉ định" />
            ) : selectedSample.tests.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                <Microscope className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Chưa có chỉ định nào</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                  Nhấn "Thêm Chỉ Định" để gán xét nghiệm cho mẫu này.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedSample.tests.map((test) => (
                  <div key={test.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between hover:border-indigo-300 transition-colors cursor-default group">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-2 h-2 rounded-full ${
                        test.status === 'Hoàn tất' ? 'bg-emerald-500' : 
                        test.status === 'Đang thực hiện' ? 'bg-blue-500 animate-pulse' : 'bg-amber-400'
                      }`} />
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">{test.code}</span>
                          <span className="text-xs text-slate-400 font-mono">#{test.id.split('-').pop()}</span>
                        </div>
                        <p className="text-sm text-slate-600">{test.name}</p>
                         {test.category && <span className="text-[10px] uppercase tracking-wide text-slate-400">{test.category}</span>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${
                           test.status === 'Hoàn tất' ? 'text-emerald-600' : 
                           test.status === 'Đang thực hiện' ? 'text-blue-600' : 'text-amber-600'
                        }`}>
                          {test.status}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                         <button className="p-1 hover:bg-slate-100 rounded text-slate-500"><MoreHorizontal className="w-4 h-4"/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isTestModalOpen && selectedSample && (
          <TestAssignmentModal 
              isOpen={isTestModalOpen} 
              onClose={() => setIsTestModalOpen(false)}
              sampleId={selectedSample.sampleId}
              existingTests={selectedSample.tests}
              onSave={handleAddTests}
          />
      )}

    </div>
  );
};

const DetailItem = ({ label, value, icon, highlight = false, isBadge = false, badgeColor = '' }: any) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
      {icon} {label}
    </span>
    {isBadge ? (
      <span className={`self-start px-2 py-0.5 rounded text-sm font-medium border ${badgeColor}`}>
        {value}
      </span>
    ) : (
      <span className={`text-sm ${highlight ? 'font-bold text-indigo-700 text-base' : 'text-slate-700'}`}>
        {value}
      </span>
    )}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="h-full flex flex-col items-center justify-center text-slate-300">
    <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
    <p className="text-sm">{message}</p>
  </div>
);

const TestAssignmentModal = ({ isOpen, onClose, sampleId, existingTests, onSave }: any) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTests, setSelectedTests] = useState<any[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('Tất cả');
    const categories = ['Tất cả', ...Array.from(new Set(TEST_CATALOG.map(t => t.category)))];

    const availableTests = TEST_CATALOG.filter(test => {
        const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              test.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'Tất cả' || test.category === activeCategory;
        const isNotAssigned = !existingTests.some((et: any) => et.code === test.code);
        return matchesSearch && matchesCategory && isNotAssigned;
    });

    const toggleTestSelection = (test: any) => {
        if (selectedTests.find(t => t.code === test.code)) {
            setSelectedTests(prev => prev.filter(t => t.code !== test.code));
        } else {
            setSelectedTests(prev => [...prev, test]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Thêm Chỉ Định</h2>
                        <p className="text-sm text-slate-500">Chọn xét nghiệm cho Mẫu <span className="font-mono font-medium text-indigo-600">{sampleId}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 flex overflow-hidden">
                    <div className="w-2/3 flex flex-col border-r border-slate-200">
                        <div className="p-4 border-b border-slate-200 space-y-4">
                            <div className="relative">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Tìm mã hoặc tên xét nghiệm..." 
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {categories.map(cat => (
                                    <button 
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                                            activeCategory === cat 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                                {availableTests.map(test => {
                                    const isSelected = selectedTests.some(t => t.code === test.code);
                                    return (
                                        <div 
                                            key={test.code}
                                            onClick={() => toggleTestSelection(test)}
                                            className={`
                                                p-3 rounded-lg border cursor-pointer transition-all duration-200 flex items-start justify-between group
                                                ${isSelected 
                                                    ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-1 ring-indigo-500' 
                                                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                                                }
                                            `}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-md ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {test.category === 'HUYẾT HỌC' ? <Dna className="w-5 h-5" /> : 
                                                     test.category === 'SINH HÓA' ? <FlaskConical className="w-5 h-5" /> : 
                                                     <Activity className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{test.code}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-1" title={test.name}>{test.name}</p>
                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">{test.category}</span>
                                                </div>
                                            </div>
                                            <div className={`
                                                w-5 h-5 rounded-full border flex items-center justify-center transition-colors
                                                ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}
                                            `}>
                                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="w-1/3 flex flex-col bg-slate-50">
                        <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Đã Chọn
                                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full ml-auto">
                                    {selectedTests.length}
                                </span>
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {selectedTests.length === 0 ? (
                                <div className="text-center text-slate-400 mt-10 text-sm italic">
                                    Chọn xét nghiệm từ danh sách bên trái.
                                </div>
                            ) : (
                                selectedTests.map(test => (
                                    <div key={test.code} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center animate-in slide-in-from-left-5 duration-200">
                                        <div>
                                            <span className="font-bold text-slate-700 text-sm block">{test.code}</span>
                                            <span className="text-xs text-slate-500 block truncate max-w-[150px]">{test.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => toggleTestSelection(test)}
                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Hủy</button>
                            <button onClick={() => onSave(selectedTests)} disabled={selectedTests.length === 0} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${selectedTests.length === 0 ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'}`}><Plus className="w-4 h-4" /> Xác Nhận</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LimsSampleLayout;
