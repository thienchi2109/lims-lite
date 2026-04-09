import type { UserRole } from '@/types'

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
    { value: 'analyst', label: 'Kỹ thuật viên' },
    { value: 'manager', label: 'Quản lý' },
    { value: 'doctor', label: 'Bác sĩ' },
]

export function getUserRoleLabel(role: string | null | undefined) {
    return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? 'Không xác định'
}
