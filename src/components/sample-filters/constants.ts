import { type SampleStatus } from '@/types'

export const statusOptions: Array<{ value: SampleStatus | 'all'; label: string; color: string }> = [
    { value: 'all', label: 'Tất cả trạng thái', color: 'bg-slate-500' },
    { value: 'received', label: 'Đã nhận', color: 'bg-yellow-500' },
    { value: 'assigned', label: 'Đã chỉ định', color: 'bg-blue-500' },
    { value: 'in_progress', label: 'Đang thực hiện', color: 'bg-indigo-500' },
    { value: 'review', label: 'Chờ duyệt', color: 'bg-purple-500' },
    { value: 'completed', label: 'Hoàn thành', color: 'bg-green-500' },
    { value: 'discarded', label: 'Loại bỏ', color: 'bg-red-500' },
]

export const sortOptions = [
    { value: 'created_at-desc', label: 'Mới nhất' },
    { value: 'created_at-asc', label: 'Cũ nhất' },
    { value: 'updated_at-desc', label: 'Mới cập nhật' },
    { value: 'updated_at-asc', label: 'Cập nhật cũ' },
    { value: 'received_at-desc', label: 'Ngày nhận (Mới)' },
    { value: 'received_at-asc', label: 'Ngày nhận (Cũ)' },
]

export const pageSizeOptions = [10, 20, 50, 100]

export const SEARCH_DEBOUNCE_MS = 250
