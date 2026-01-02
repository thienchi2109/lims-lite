import type { DriveStep } from 'driver.js'

/**
 * IQC Analyst Tour - 7 steps
 * Target page: /analyst/qc-entry
 * Target users: Analysts
 * Focus: Full QC entry workflow with Westgard feedback
 */
export const iqcAnalystTourSteps: DriveStep[] = [
    {
        element: '#tour-iqc-header',
        popover: {
            title: 'Trang nhập QC',
            description: 'Giới thiệu trang kiểm soát chất lượng nội bộ. Đây là nơi bạn nhập kết quả QC hàng ngày trước khi chạy mẫu bệnh phẩm.',
            side: 'bottom',
            align: 'start',
        },
    },
    {
        element: '#tour-iqc-specialty-tabs',
        popover: {
            title: 'Chọn nhóm kỹ thuật xét nghiệm',
            description: 'Chọn tab để xem các xét nghiệm QC tương ứng. Số trong ngoặc là số xét nghiệm cần chạy QC.',
            side: 'bottom',
            align: 'start',
        },
    },
    {
        element: '#tour-iqc-assay-card',
        popover: {
            title: 'Thẻ xét nghiệm',
            description: 'Mỗi thẻ hiển thị: tên XN, vật liệu QC, Mean/SD, trạng thái phiên hiện tại.',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '#tour-iqc-status-badge',
        popover: {
            title: 'Trạng thái QC',
            description: 'Badge hiển thị trạng thái: Chờ QC, Đạt, Cảnh báo, hoặc Mất kiểm soát.',
            side: 'left',
            align: 'center',
        },
    },
    {
        element: '#tour-iqc-entry-button',
        popover: {
            title: 'Nhập kết quả',
            description: 'Bấm để mở form nhập giá trị QC đo được.',
            side: 'left',
            align: 'center',
        },
    },
    {
        element: '#tour-iqc-westgard-feedback',
        popover: {
            title: 'Đánh giá Westgard',
            description: 'Hệ thống tự động tính Z-score và kiểm tra quy tắc Westgard. Màu xanh = Đạt, vàng = Cảnh báo, đỏ = Vi phạm.',
            side: 'top',
            align: 'center',
        },
    },
    {
        element: '#tour-iqc-save-button',
        popover: {
            title: 'Lưu kết quả',
            description: 'Bấm Lưu để ghi nhận. Nếu vi phạm, cần thông báo Quản lý xử lý trước khi tiếp tục xét nghiệm bệnh phẩm.',
            side: 'top',
            align: 'center',
        },
    },
]
