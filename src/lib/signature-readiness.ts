import type { UserRole } from '@/types'

type SignatureRecord = {
    is_active?: boolean | null
}

export const SIGNATURE_SUBMIT_BLOCKED_MESSAGE = 'Vui lòng tải lên chữ ký trong Hồ sơ trước khi nộp'
export const SIGNATURE_PROFILE_REQUIRED_MESSAGE =
    'Tải lên chữ ký điện tử trong Hồ sơ là bắt buộc trước khi nộp kết quả xét nghiệm.'

const SIGNATURE_OWNER_ROLES = new Set<UserRole>(['manager', 'analyst'])

export function canOwnElectronicSignature(role: UserRole | undefined): boolean {
    return Boolean(role && SIGNATURE_OWNER_ROLES.has(role))
}

export function hasActiveElectronicSignature(signatures: SignatureRecord[] | null | undefined): boolean {
    return signatures?.some((signature) => signature.is_active === true) ?? false
}

export function getSignatureReadinessTitle(fullName: string, hasSignature: boolean): string {
    return hasSignature
        ? `${fullName} đã có chữ ký điện tử`
        : `${fullName} chưa có chữ ký điện tử`
}

export function getSignatureSelfUploadGuidance(role: UserRole | undefined): string | null {
    if (role === 'analyst') {
        return 'Phân tích viên sẽ tự tải lên chữ ký điện tử trong Hồ sơ sau khi đăng nhập. Quản lý không thể tải lên chữ ký thay họ để đảm bảo tuân thủ.'
    }

    if (role === 'manager') {
        return 'Người dùng này cần tự tải lên chữ ký điện tử của họ khi đăng nhập. Bạn không thể tải lên chữ ký thay họ để đảm bảo tuân thủ quy định.'
    }

    return null
}
