'use client'

import { useState } from 'react'
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { QCEntryForm } from './qc-entry-form'
import type { QCStatus } from '@/types/qc'

// ============================================================================
// TYPES
// ============================================================================

interface AssayWithQC {
    id: string
    name: string
    units: string | null
    specialty_id: string
    definition_id: string
    mean: number
    sd: number
    material_name: string
    material_level: string
    lot_number: string
    session_id: string | null
    qc_status: string | null
}

interface QCAssayCardProps {
    assay: AssayWithQC
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

const STATUS_CONFIG: Record<string, {
    icon: typeof CheckCircle2
    label: string
    className: string
}> = {
    pending: {
        icon: Clock,
        label: 'Chờ QC',
        className: 'bg-slate-100 text-slate-700',
    },
    pass: {
        icon: CheckCircle2,
        label: 'Đạt',
        className: 'bg-green-100 text-green-700',
    },
    warning: {
        icon: AlertTriangle,
        label: 'Cảnh báo',
        className: 'bg-yellow-100 text-yellow-700',
    },
    blocked: {
        icon: XCircle,
        label: 'Mất kiểm soát',
        className: 'bg-red-100 text-red-700',
    },
    resolved: {
        icon: CheckCircle2,
        label: 'Đã xử lý',
        className: 'bg-blue-100 text-blue-700',
    },
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCAssayCard({ assay }: QCAssayCardProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Get status configuration
    const status = assay.qc_status as QCStatus | null
    const statusConfig = status ? STATUS_CONFIG[status] : null
    const StatusIcon = statusConfig?.icon || Clock

    // Build definition option for form
    const definitionOption = {
        id: assay.definition_id,
        materialName: assay.material_name,
        level: assay.material_level,
        lotNumber: assay.lot_number,
        mean: assay.mean,
        sd: assay.sd,
    }

    // Placeholder session for form (session management is Phase 15)
    const placeholderSession = assay.session_id ? {
        id: assay.session_id,
        assay_id: assay.id,
        session_mode: 'daily' as const,
        qc_status: (assay.qc_status || 'pending') as QCStatus,
        started_at: new Date().toISOString(),
        started_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    } : null

    const handleSuccess = () => {
        setIsDialogOpen(false)
        // TODO: Refresh data via router.refresh() or query invalidation
    }

    return (
        <Card id="tour-iqc-assay-card" className="flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                        <CardTitle className="text-base truncate" title={assay.name}>
                            {assay.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {assay.material_name} - {assay.material_level}
                        </CardDescription>
                    </div>
                    {statusConfig && (
                        <Badge id="tour-iqc-status-badge" className={`shrink-0 gap-1 ${statusConfig.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                        </Badge>
                    )}
                    {!statusConfig && (
                        <Badge variant="outline" className="shrink-0 gap-1">
                            <Clock className="h-3 w-3" />
                            Chưa có phiên
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-3">
                {/* Control Limits Display */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs rounded-md bg-muted p-2">
                    <div>
                        <span className="text-muted-foreground block">Mean</span>
                        <span className="font-mono font-medium">{assay.mean.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground block">SD</span>
                        <span className="font-mono font-medium">{assay.sd.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground block">Lô</span>
                        <span className="font-mono font-medium truncate block" title={assay.lot_number}>
                            {assay.lot_number}
                        </span>
                    </div>
                </div>

                {/* Mini L-J Chart placeholder - Phase 14.5 */}
                <div className="h-24 rounded-md border border-dashed flex items-center justify-center text-muted-foreground text-xs">
                    Biểu đồ L-J (30 ngày gần đây)
                </div>

                {/* Entry Button */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button id="tour-iqc-entry-button" className="w-full gap-2" size="sm">
                            <Activity className="h-4 w-4" />
                            Nhập kết quả QC
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Nhập kết quả QC - {assay.name}</DialogTitle>
                        </DialogHeader>
                        {placeholderSession ? (
                            <QCEntryForm
                                session={placeholderSession}
                                definitions={[definitionOption]}
                                assayName={assay.name}
                                assayUnits={assay.units}
                                onSuccess={handleSuccess}
                            />
                        ) : (
                            <div className="text-center py-6 space-y-4">
                                <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
                                <div className="space-y-2">
                                    <p className="font-medium">Chưa có phiên QC đang hoạt động</p>
                                    <p className="text-sm text-muted-foreground">
                                        Vui lòng yêu cầu Quản lý bắt đầu phiên QC cho xét nghiệm này.
                                    </p>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}
