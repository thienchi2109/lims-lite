import type { DriveStep } from 'driver.js'

/**
 * Manager Approval Tour - 6 steps
 * Target page: /manager/approvals
 * Target users: Managers
 */
export const approvalTourSteps: DriveStep[] = [
    {
        element: '#tour-approval-tabs',
        popover: {
            title: 'Danh sách chờ duyệt',
            description: 'Tab "Chờ duyệt KQ" hiển thị các mẫu cần phê duyệt. Con số đỏ cho biết số lượng đang chờ.',
            side: 'bottom',
            align: 'start',
        },
    },
    {
        element: '#tour-approval-queue',
        popover: {
            title: 'Chọn mẫu',
            description: 'Bấm vào một dòng để xem chi tiết mẫu và kết quả xét nghiệm bên dưới.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '#tour-approval-detail',
        popover: {
            title: 'Chi tiết mẫu',
            description: 'Thông tin khách hàng, loại mẫu, thời gian nhận và lịch sử xử lý.',
            side: 'top',
            align: 'start',
        },
    },
    {
        element: '#tour-approval-actions',
        popover: {
            title: 'Xem kết quả',
            description: 'Kiểm tra các kết quả do analyst nhập. Giá trị ngoài khoảng tham chiếu được đánh dấu.',
            side: 'top',
            align: 'center',
        },
    },
    {
        element: '#tour-approve-button',
        popover: {
            title: 'Phê duyệt',
            description: 'Bấm để phê duyệt các kết quả đã chọn. Yêu cầu chữ ký điện tử theo 21 CFR Part 11.',
            side: 'left',
            align: 'start',
        },
    },
    {
        element: '#tour-reject-button',
        popover: {
            title: 'Từ chối hoặc loại bỏ',
            description: '"Từ chối mẫu" trả về cho analyst sửa. "Loại bỏ mẫu" hủy vĩnh viễn (cần ghi lý do).',
            side: 'left',
            align: 'start',
        },
    },
]
