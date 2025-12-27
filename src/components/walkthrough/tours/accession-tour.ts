import type { DriveStep } from 'driver.js'

/**
 * Sample Accession Tour - 6 steps
 * Target page: /analyst/accession
 * Target users: Analysts
 */
export const accessionTourSteps: DriveStep[] = [
    {
        element: '#tour-qr-scanner',
        popover: {
            title: 'Quét mã khách hàng',
            description: 'Bấm vào đây để quét mã QR của khách hàng. Bạn cũng có thể tìm kiếm thủ công ở bước tiếp theo.',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '#tour-client-selector',
        popover: {
            title: 'Chọn khách hàng',
            description: 'Tìm kiếm hoặc chọn khách hàng từ danh sách. Nếu chưa có, bấm "Thêm mới" để tạo.',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '#tour-sample-type',
        popover: {
            title: 'Loại mẫu',
            description: 'Chọn loại mẫu xét nghiệm (Máu, Nước tiểu, v.v.). Mặc định là "Máu".',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '#tour-received-time',
        popover: {
            title: 'Thời gian nhận mẫu',
            description: 'Ghi nhận thời điểm nhận mẫu. Hệ thống tự động điền giờ hiện tại.',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '#tour-test-assignment',
        popover: {
            title: 'Chỉ định xét nghiệm',
            description: 'Chọn các xét nghiệm cần thực hiện. Dùng checkbox hoặc tìm kiếm theo tên.',
            side: 'top',
            align: 'center',
        },
    },
    {
        element: '#tour-save-button',
        popover: {
            title: 'Lưu mẫu',
            description: 'Bấm để lưu mẫu và chỉ định xét nghiệm. Mẫu sẽ xuất hiện trong danh sách chờ nhập kết quả.',
            side: 'left',
            align: 'start',
        },
    },
]
