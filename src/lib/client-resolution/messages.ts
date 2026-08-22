import type {
  ClientResolutionCallerContext,
  ClientResolutionReasonCode,
  ClientResolutionResult,
} from '@/types'

export const CLIENT_RESOLUTION_LABELS = {
  matched: 'Đã khớp',
  not_found: 'Không tìm thấy khách hàng',
  ambiguous: 'Không thể xác định duy nhất',
  conflict: 'Xung đột thông tin',
} as const satisfies Record<ClientResolutionResult['outcome'], string>

const REASON_MESSAGES: Record<ClientResolutionReasonCode, string> = {
  trusted_identity_match: 'CCCD/CMND khớp với một khách hàng đang hoạt động.',
  trusted_identity_not_found:
    'Không tìm thấy CCCD/CMND này. Chỉ tạo mới sau khi xác nhận thông tin.',
  trusted_identity_ambiguous:
    'CCCD/CMND trùng với nhiều hồ sơ. Cần quản lý xử lý trước khi tiếp tục.',
  trusted_identity_disagreement:
    'CCCD/CMND không khớp với họ tên, ngày sinh hoặc số điện thoại đã lưu.',
  name_dob_match:
    'Họ tên và ngày sinh khớp với một khách hàng đang hoạt động.',
  identity_not_found:
    'Không tìm thấy khách hàng phù hợp. Chỉ tạo mới sau khi xác nhận thông tin.',
  name_dob_ambiguous:
    'Họ tên và ngày sinh khớp với nhiều hồ sơ. Cần quản lý xử lý trước.',
  inactive_candidate:
    'Hồ sơ phù hợp đã ngừng hoạt động. Cần quản lý xem xét khôi phục.',
  accent_only_conflict:
    'Họ tên chỉ khác dấu với hồ sơ đã có. Cần kiểm tra trước khi tiếp tục.',
  phone_conflict:
    'Số điện thoại đang gắn với hồ sơ khác và không thể dùng để tạo mới.',
  cross_key_conflict:
    'Các thông tin định danh đang chỉ đến những hồ sơ khác nhau.',
  identity_conflict:
    'Thông tin định danh có xung đột và không thể xử lý tự động.',
  invalid_identity_input:
    'Thông tin định danh không hợp lệ hoặc chưa được cung cấp đầy đủ.',
  client_created: 'Khách hàng đã được tạo sau khi xác nhận không có xung đột.',
}

function formatContext(context?: ClientResolutionCallerContext) {
  if (!context) return ''

  const parts = [
    context.sheet ? `trang tính ${context.sheet}` : null,
    context.row ? `dòng ${context.row}` : null,
    context.column ? `cột ${context.column}` : null,
    context.temporaryReference
      ? `tham chiếu ${context.temporaryReference}`
      : null,
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

export function localizeClientResolution(
  result: ClientResolutionResult,
  context?: ClientResolutionCallerContext,
) {
  return {
    label: CLIENT_RESOLUTION_LABELS[result.outcome],
    message: `${REASON_MESSAGES[result.reasonCode]}${formatContext(context)}`,
  }
}
