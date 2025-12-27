import type { DriveStep } from 'driver.js'

/**
 * Results Submission Tour - 5 steps
 * Target page: /analyst/results/[sampleId]
 * Target users: Analysts
 */
export const resultsTourSteps: DriveStep[] = [
    {
        element: '#tour-sample-detail',
        popover: {
            title: 'Thông tin mẫu',
            description: 'Đây là thông tin mẫu đang xử lý: mã mẫu, khách hàng, loại mẫu và trạng thái hiện tại.',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '#tour-results-table',
        popover: {
            title: 'Bảng kết quả',
            description: 'Danh sách các xét nghiệm được chỉ định. Mỗi dòng là một xét nghiệm cần nhập kết quả.',
            side: 'top',
            align: 'center',
        },
    },
    {
        element: '#tour-results-table tbody tr:first-child td:nth-child(3)',
        popover: {
            title: 'Nhập kết quả',
            description: 'Bấm vào ô kết quả để nhập giá trị. Dùng Tab hoặc Enter để chuyển sang ô tiếp theo.',
            side: 'left',
            align: 'center',
        },
    },
    {
        element: '#tour-batch-save',
        popover: {
            title: 'Lưu thay đổi',
            description: 'Thanh công cụ hiển thị số thay đổi chưa lưu. Bấm "Lưu" để lưu tất cả hoặc "Hủy" để bỏ.',
            side: 'top',
            align: 'center',
        },
    },
    {
        element: '#tour-submit-review',
        popover: {
            title: 'Gửi duyệt',
            description: 'Khi đã nhập đủ kết quả, bấm "Gửi duyệt" để chuyển cho quản lý phê duyệt. Không thể chỉnh sửa sau khi gửi.',
            side: 'left',
            align: 'start',
        },
    },
]
