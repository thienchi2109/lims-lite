/** Vietnamese labels for sample grid components */
export const GRID_LABELS = {
  columns: {
    sampleId: 'Mã mẫu',
    clientName: 'Khách hàng',
    status: 'Trạng thái',
    receivedAt: 'Ngày nhận',
    updatedAt: 'Ngày cập nhật',
    receiver: 'Người nhận',
    actions: 'Hành động',
    coa: 'CoA',
    progress: 'Tiến độ',
  },
  pagination: {
    showing: 'Hiển thị',
    of: 'của',
    samples: 'mẫu',
    loadingPage: 'Đang chuyển trang...',
    loadingFilter: 'Đang cập nhật danh sách...',
  },
  empty: {
    noSamples: 'Không tìm thấy mẫu nào',
    noApprovals: 'Không có mẫu nào chờ phê duyệt',
  },
  progress: {
    tests: 'xét nghiệm',
    entered: 'đã nhập',
    approved: 'đã duyệt',
  },
} as const
