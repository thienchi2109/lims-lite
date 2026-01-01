'use client'

import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// ============================================================================
// TYPES
// ============================================================================

export interface ActiveSession {
    id: string
    assay_id: string
    assay_name: string
    session_mode: string
    qc_status: string
    started_at: string
}

export interface PendingViolation {
    id: string
    rule_violated: string
    z_score: number
    value: number
    mean: number
    sd: number
    assay_name: string
    assay_units: string | null
    material_name: string
    material_level: string
    session_mode: string
    created_at: string
}

interface QCOverviewTabProps {
    activeSessions: ActiveSession[]
    pendingViolations: PendingViolation[]
    onViewAllSessions: () => void
    onViewAllViolations: () => void
    onResolveViolation: (violation: PendingViolation) => void
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<string, {
    icon: typeof CheckCircle2
    label: string
    className: string
}> = {
    pending: { icon: Clock, label: 'Chờ QC', className: 'bg-slate-100 text-slate-700' },
    pass: { icon: CheckCircle2, label: 'Đạt', className: 'bg-green-100 text-green-700' },
    warning: { icon: AlertTriangle, label: 'Cảnh báo', className: 'bg-yellow-100 text-yellow-700' },
    blocked: { icon: AlertTriangle, label: 'Mất kiểm soát', className: 'bg-red-100 text-red-700' },
    resolved: { icon: CheckCircle2, label: 'Đã xử lý', className: 'bg-blue-100 text-blue-700' },
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCOverviewTab({
    activeSessions,
    pendingViolations,
    onViewAllSessions,
    onViewAllViolations,
    onResolveViolation,
}: QCOverviewTabProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Sessions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Phiên QC đang hoạt động</CardTitle>
                    <CardDescription>
                        Các phiên QC hiện tại cho từng xét nghiệm
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {activeSessions.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            Không có phiên QC nào đang hoạt động
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeSessions.slice(0, 5).map((session) => {
                                const statusConfig = STATUS_CONFIG[session.qc_status] || STATUS_CONFIG.pending
                                const StatusIcon = statusConfig.icon
                                return (
                                    <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border">
                                        <div>
                                            <div className="font-medium">{session.assay_name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {session.session_mode === 'daily' ? 'Hàng ngày' :
                                                 session.session_mode === 'batch' ? 'Theo lô' : 'Theo ca'}
                                            </div>
                                        </div>
                                        <Badge className={`gap-1 ${statusConfig.className}`}>
                                            <StatusIcon className="h-3 w-3" />
                                            {statusConfig.label}
                                        </Badge>
                                    </div>
                                )
                            })}
                            {activeSessions.length > 5 && (
                                <Button variant="link" className="w-full" onClick={onViewAllSessions}>
                                    Xem tất cả {activeSessions.length} phiên
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pending Violations */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Vi phạm chờ xử lý</CardTitle>
                    <CardDescription>
                        Các vi phạm quy tắc Westgard cần hành động khắc phục
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {pendingViolations.length === 0 ? (
                        <div className="text-center py-6 text-green-600">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                            Không có vi phạm nào
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingViolations.slice(0, 5).map((violation) => (
                                <div
                                    key={violation.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 cursor-pointer hover:bg-red-100 transition-colors"
                                    onClick={() => onResolveViolation(violation)}
                                >
                                    <div>
                                        <div className="font-medium text-red-700">
                                            {violation.assay_name} - {violation.material_level}
                                        </div>
                                        <div className="text-xs text-red-600">
                                            Quy tắc: {violation.rule_violated} | Z = {violation.z_score.toFixed(2)}
                                        </div>
                                    </div>
                                    <Badge variant="destructive">Xử lý</Badge>
                                </div>
                            ))}
                            {pendingViolations.length > 5 && (
                                <Button variant="link" className="w-full text-red-600" onClick={onViewAllViolations}>
                                    Xem tất cả {pendingViolations.length} vi phạm
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
