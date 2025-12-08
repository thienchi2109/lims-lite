'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { 
    FileEdit, 
    FlaskConical, 
    CheckCircle, 
    XCircle, 
    RefreshCw,
    Activity,
    Loader2,
    AlertCircle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AuditLog {
    id: string
    table_name: string
    operation: string
    old_values: Record<string, any> | null
    new_values: Record<string, any> | null
    changed_by: string | null
    changed_at: string
    user?: {
        full_name: string
    }
}

interface SampleActivityFeedProps {
    sampleId: string
}

export function SampleActivityFeed({ sampleId }: SampleActivityFeedProps) {
    const { data: activities, isLoading, error } = useQuery({
        queryKey: ['sample-activities', sampleId],
        queryFn: async () => {
            const supabase = createClient()
            
            // Fetch audit logs for this sample and its related results
            const { data, error } = await supabase
                .from('audit_logs')
                .select(`
                    id,
                    table_name,
                    operation,
                    old_values,
                    new_values,
                    changed_by,
                    changed_at,
                    user:users!audit_logs_changed_by_fkey(full_name)
                `)
                .or(`record_id.eq.${sampleId},new_values->>sample_id.eq.${sampleId},old_values->>sample_id.eq.${sampleId}`)
                .order('changed_at', { ascending: false })
                .limit(50)
            
            if (error) throw error
            
            // Transform data to handle single user object (Supabase returns array for joins)
            const transformedData = data?.map(log => ({
                ...log,
                user: Array.isArray(log.user) ? log.user[0] : log.user
            })) || []
            
            return transformedData as AuditLog[]
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    })

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-64 flex-col items-center justify-center text-red-500">
                <AlertCircle className="mb-2 h-8 w-8" />
                <p className="text-sm">Không thể tải lịch sử hoạt động</p>
            </div>
        )
    }

    if (!activities || activities.length === 0) {
        return (
            <Card>
                <CardContent className="flex h-64 flex-col items-center justify-center p-8 text-muted-foreground">
                    <Activity className="mb-3 h-12 w-12 text-slate-300" />
                    <p>Chưa có hoạt động nào được ghi nhận</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                    {activities.map((activity) => (
                        <ActivityItem key={activity.id} activity={activity} />
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

function ActivityItem({ activity }: { activity: AuditLog }) {
    const { icon, color, message } = getActivityDisplay(activity)
    const Icon = icon
    const userName = getUserName(activity.user)
    
    return (
        <div className="flex gap-4 p-4 hover:bg-slate-50/50 transition-colors">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700">{message}</p>
                    <OperationBadge operation={activity.operation} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">
                        {userName}
                    </span>
                    <span>•</span>
                    <span>
                        {formatDistanceToNow(new Date(activity.changed_at), {
                            addSuffix: true,
                            locale: vi,
                        })}
                    </span>
                </div>
                {activity.operation === 'UPDATE' && (
                    <ChangeDetails 
                        oldValues={activity.old_values} 
                        newValues={activity.new_values}
                        tableName={activity.table_name}
                    />
                )}
            </div>
        </div>
    )
}

function getActivityDisplay(activity: AuditLog): {
    icon: typeof FileEdit
    color: string
    message: string
} {
    const { table_name, operation, old_values, new_values } = activity

    if (table_name === 'results') {
        if (operation === 'INSERT') {
            return {
                icon: FlaskConical,
                color: 'bg-blue-100 text-blue-600',
                message: 'Thêm xét nghiệm mới',
            }
        }
        if (operation === 'UPDATE') {
            // Check what changed
            if (new_values?.value && old_values?.value !== new_values?.value) {
                return {
                    icon: FileEdit,
                    color: 'bg-indigo-100 text-indigo-600',
                    message: `Cập nhật kết quả xét nghiệm`,
                }
            }
            if (new_values?.status === 'approved') {
                return {
                    icon: CheckCircle,
                    color: 'bg-green-100 text-green-600',
                    message: 'Duyệt kết quả xét nghiệm',
                }
            }
            if (old_values?.status === 'approved' && new_values?.status === 'entered') {
                return {
                    icon: XCircle,
                    color: 'bg-orange-100 text-orange-600',
                    message: 'Hủy duyệt kết quả',
                }
            }
            return {
                icon: RefreshCw,
                color: 'bg-slate-100 text-slate-600',
                message: 'Cập nhật trạng thái kết quả',
            }
        }
    }

    if (table_name === 'samples') {
        if (operation === 'INSERT') {
            return {
                icon: FlaskConical,
                color: 'bg-emerald-100 text-emerald-600',
                message: 'Tạo mẫu mới',
            }
        }
        if (operation === 'UPDATE') {
            // Check what changed
            if (old_values?.status !== new_values?.status) {
                return {
                    icon: RefreshCw,
                    color: 'bg-purple-100 text-purple-600',
                    message: `Thay đổi trạng thái: ${getStatusLabel(old_values?.status)} → ${getStatusLabel(new_values?.status)}`,
                }
            }
            if (old_values?.client_name !== new_values?.client_name) {
                return {
                    icon: FileEdit,
                    color: 'bg-blue-100 text-blue-600',
                    message: 'Cập nhật thông tin khách hàng',
                }
            }
            return {
                icon: FileEdit,
                color: 'bg-slate-100 text-slate-600',
                message: 'Cập nhật thông tin mẫu',
            }
        }
    }

    // Default fallback
    return {
        icon: Activity,
        color: 'bg-slate-100 text-slate-600',
        message: `${operation} trên ${table_name}`,
    }
}

function OperationBadge({ operation }: { operation: string }) {
    const config = {
        INSERT: { label: 'Thêm', variant: 'default' as const },
        UPDATE: { label: 'Sửa', variant: 'secondary' as const },
        DELETE: { label: 'Xóa', variant: 'destructive' as const },
    }

    const { label, variant } = config[operation as keyof typeof config] || {
        label: operation,
        variant: 'outline' as const,
    }

    return (
        <Badge variant={variant} className="text-xs">
            {label}
        </Badge>
    )
}

function ChangeDetails({
    oldValues,
    newValues,
    tableName,
}: {
    oldValues: Record<string, any> | null
    newValues: Record<string, any> | null
    tableName: string
}) {
    if (!oldValues || !newValues) return null

    // Only show meaningful changes
    const changes: Array<{ field: string; old: any; new: any }> = []

    const fieldsToShow = tableName === 'results' 
        ? ['value', 'status', 'approval_note']
        : ['client_name', 'status']

    fieldsToShow.forEach((field) => {
        if (oldValues[field] !== newValues[field]) {
            changes.push({
                field,
                old: oldValues[field],
                new: newValues[field],
            })
        }
    })

    if (changes.length === 0) return null

    return (
        <div className="mt-2 space-y-1 rounded-md bg-slate-50 p-2 text-xs">
            {changes.map((change, index) => (
                <div key={index} className="flex items-center gap-2">
                    <span className="font-medium text-slate-600">
                        {getFieldLabel(change.field)}:
                    </span>
                    <span className="text-slate-400 line-through">
                        {formatValue(change.old)}
                    </span>
                    <span>→</span>
                    <span className="font-medium text-slate-700">
                        {formatValue(change.new)}
                    </span>
                </div>
            ))}
        </div>
    )
}

function getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
        value: 'Giá trị',
        status: 'Trạng thái',
        client_name: 'Khách hàng',
        approval_note: 'Ghi chú duyệt',
    }
    return labels[field] || field
}

function getStatusLabel(status: string | null | undefined): string {
    if (!status) return 'N/A'
    
    const labels: Record<string, string> = {
        received: 'Đã nhận',
        assigned: 'Đã chỉ định',
        in_progress: 'Đang xử lý',
        review: 'Chờ duyệt',
        completed: 'Hoàn thành',
        discarded: 'Đã loại bỏ',
        pending: 'Chưa nhập',
        entered: 'Đã nhập',
        approved: 'Đã duyệt',
    }
    return labels[status] || status
}

function formatValue(value: any): string {
    if (value === null || value === undefined) return 'Trống'
    if (typeof value === 'boolean') return value ? 'Có' : 'Không'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

function getUserName(user: AuditLog['user']): string {
    if (!user) return 'Hệ thống'
    if (Array.isArray(user)) return user[0]?.full_name || 'Hệ thống'
    return user.full_name || 'Hệ thống'
}
