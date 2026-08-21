const LEGACY_ASSIGNMENT_REQUEST_MESSAGE =
    'Dữ liệu chỉ định đã cũ. Vui lòng tải lại trang và chọn lại loại mẫu.'

const GENERIC_ASSIGNMENT_FAILURE_MESSAGE =
    'Không thể lưu chỉ định xét nghiệm. Vui lòng tải lại trang và thử lại.'

export function hasAssignmentV2Fields(data: unknown) {
    return (
        typeof data === 'object' &&
        data !== null &&
        'sampleTypeId' in data &&
        'sampleTypeCode' in data &&
        'expectedRevisionNumber' in data
    )
}

export function createLegacyAssignmentRequestError() {
    return { error: LEGACY_ASSIGNMENT_REQUEST_MESSAGE }
}

export function mapAssignmentV2RpcError(error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : null

    switch (code) {
        case 'P1100':
            return 'Catalog tương thích chưa sẵn sàng. Vui lòng tải lại trang hoặc báo quản lý phòng xét nghiệm.'
        case 'P1101':
        case 'P1106':
            return 'Catalog tương thích đã thay đổi. Vui lòng tải lại trang và chọn lại loại mẫu.'
        case 'P1102':
            return 'Loại mẫu đã chọn không còn hợp lệ. Vui lòng tải lại trang và chọn lại loại mẫu.'
        case 'P1103':
            return 'Chỉ tiêu đã chọn không còn khả dụng. Vui lòng tải lại trang và chọn lại.'
        case 'P1104':
            return 'Chỉ tiêu đã chọn chưa được cấu hình tương thích. Vui lòng chọn lại.'
        case 'P1105':
            return 'Chỉ tiêu đã chọn không tương thích với loại mẫu. Vui lòng chọn lại.'
        case '23502':
            return 'Chất lượng mẫu là bắt buộc.'
        case '42501':
            return 'Bạn không có quyền thực hiện thao tác này.'
        default:
            return GENERIC_ASSIGNMENT_FAILURE_MESSAGE
    }
}

export function mapAssignmentV2ActionError(error: unknown) {
    const issues = typeof error === 'object' && error !== null && 'issues' in error
        ? (error as { issues?: Array<{ path?: Array<string | number> }> }).issues
        : null

    if (Array.isArray(issues)) {
        const hasSampleQualityIssue = issues.some((issue) =>
            issue.path?.includes('sample_quality'),
        )
        return hasSampleQualityIssue
            ? 'Chất lượng mẫu là bắt buộc.'
            : 'Dữ liệu chỉ định không hợp lệ. Vui lòng tải lại trang và thử lại.'
    }

    return GENERIC_ASSIGNMENT_FAILURE_MESSAGE
}
