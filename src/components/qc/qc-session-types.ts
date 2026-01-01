import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react'

// Session mode labels in Vietnamese
export const SESSION_MODE_LABELS: Record<string, string> = {
    daily: 'Hàng ngày',
    batch: 'Theo lô',
    shift: 'Theo ca',
}

// Status configuration
export const STATUS_CONFIG: Record<string, {
    icon: typeof CheckCircle2
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
}> = {
    pending: { icon: Clock, label: 'Chờ QC', variant: 'outline', className: '' },
    pass: { icon: CheckCircle2, label: 'Đạt', variant: 'default', className: 'bg-green-600' },
    warning: { icon: AlertTriangle, label: 'Cảnh báo', variant: 'secondary', className: 'bg-yellow-500 text-black' },
    blocked: { icon: XCircle, label: 'Bị chặn', variant: 'destructive', className: '' },
    resolved: { icon: CheckCircle2, label: 'Đã xử lý', variant: 'outline', className: 'border-green-600 text-green-600' },
}

export interface AssayOption {
    id: string
    name: string
}

export interface SessionWithDetails {
    id: string
    assay_id: string
    session_mode: string
    qc_status: string
    started_at: string
    started_by: string
    ended_at: string | null
    notes: string | null
    assay?: { id: string; name: string }
    started_by_user?: { full_name: string }
    ended_by_user?: { full_name: string } | null
}
