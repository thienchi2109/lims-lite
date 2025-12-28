import type { DriveStep } from 'driver.js'

/**
 * CoA Generation Tour - 2 steps
 * Target pages: /samples (Analyst), /manager/approvals?tab=completed (Manager)
 * Target users: Analyst, Manager
 */
export const coaTourSteps: DriveStep[] = [
    {
        element: '#tour-coa-generate',
        popover: {
            title: 'Tạo giấy chứng nhận',
            description: 'Bấm để tạo CoA cho mẫu đã hoàn thành. Nếu tạo thất bại, bấm "Tạo lại CoA" để thử lại.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '#tour-coa-view',
        popover: {
            title: 'Xem phiếu kết quả',
            description: 'Sau khi tạo thành công, bấm để mở phiếu kết quả xét nghiệm. Một cửa sổ trình duyệt mới hiện ra, bạn có thể nhấn Ctrl+P để in kết quả này hoặc lưu dưới dạng PDF. Sau đó có thể gửi cho khách hàng và lưu trữ nội bộ.',
            side: 'bottom',
            align: 'center',
        },
    },
]
