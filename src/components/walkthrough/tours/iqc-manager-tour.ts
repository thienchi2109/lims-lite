import type { DriveStep } from 'driver.js'

/**
 * IQC Manager Tour - 7 steps
 * Target page: /manager/quality-control
 * Target users: Managers
 * Focus: Overview + key actions (not all 6 tabs)
 */
export const iqcManagerTourSteps: DriveStep[] = [
    {
        element: '#tour-iqc-mgr-header',
        popover: {
            title: 'Quản lý QC',
            description: 'Trang thiết lập và giám sát kiểm soát chất lượng nội bộ theo quy tắc Westgard.',
            side: 'bottom',
            align: 'start',
        },
    },
    {
        element: '#tour-iqc-mgr-stats',
        popover: {
            title: 'Thống kê tổng quan',
            description: 'Hiển thị số vật liệu, giới hạn đang hoạt động, phiên QC, và vi phạm chờ xử lý.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '#tour-iqc-mgr-violations-alert',
        popover: {
            title: 'Cảnh báo vi phạm',
            description: 'Khi có vi phạm Westgard, hệ thống sẽ chặn phê duyệt kết quả cho đến khi xử lý xong.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '#tour-iqc-mgr-tabs',
        popover: {
            title: 'Các tab quản lý',
            description: 'Tổng quan, Vật liệu, Giới hạn, Phiên QC, Vi phạm, và Phân tích.',
            side: 'bottom',
            align: 'start',
        },
    },
    {
        element: '#tour-iqc-mgr-establish-limits',
        popover: {
            title: 'Thiết lập giới hạn',
            description: 'Bấm để tạo giới hạn kiểm soát mới (Mean, SD) cho một xét nghiệm với vật liệu QC cụ thể.',
            side: 'left',
            align: 'center',
        },
    },
    {
        element: '#tour-iqc-mgr-sessions',
        popover: {
            title: 'Quản lý phiên',
            description: 'Bắt đầu/kết thúc phiên QC cho từng xét nghiệm. Analyst chỉ có thể nhập QC khi có phiên đang mở.',
            side: 'left',
            align: 'center',
        },
    },
    {
        element: '#tour-iqc-mgr-resolve',
        popover: {
            title: 'Xử lý vi phạm',
            description: 'Khi vi phạm xảy ra, vào tab Vi phạm để ghi nhận hành động khắc phục và mở khóa phê duyệt.',
            side: 'top',
            align: 'center',
        },
    },
]
