'use client'

import { useState } from 'react'
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Beaker,
    LineChart,
    ListChecks,
    Plus,
    RefreshCw,
    Settings,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QCStatsCards } from './qc-stats-cards'
import { QCOverviewTab, type ActiveSession, type PendingViolation } from './qc-overview-tab'
import { QCViolationsTab } from './qc-violations-tab'
import { QCMaterialsTable, type QCMaterial } from './qc-materials-table'
import { QCDefinitionsTable, type QCDefinitionWithDetails } from './qc-definitions-table'
import { QCSessionManager } from './qc-session-manager'
import { ControlLimitsWizard } from './control-limits-wizard'
import { LotChangeoverDialog } from './lot-changeover-dialog'
import { ViolationResolutionDialog } from './violation-resolution-dialog'
import { QCAnalyticsTab, type QCDefinitionForAnalytics, type QCResultDataPoint } from './qc-analytics-tab'

// ============================================================================
// TYPES
// ============================================================================

interface Assay {
    id: string
    name: string
    units: string | null
    specialty_id: string | null
}

interface Stats {
    totalMaterials: number
    totalDefinitions: number
    activeDefinitions: number
    activeSessions: number
    pendingViolations: number
    blockedSessions: number
}

interface QualityControlPageClientProps {
    stats: Stats
    materials: QCMaterial[]
    definitions: QCDefinitionWithDetails[]
    activeSessions: ActiveSession[]
    pendingViolations: PendingViolation[]
    assays: Assay[]
    analyticsDefinitions: QCDefinitionForAnalytics[]
    qcResults: Record<string, QCResultDataPoint[]>
    qcDays: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QualityControlPageClient({
    stats,
    materials,
    definitions,
    activeSessions,
    pendingViolations,
    assays,
    analyticsDefinitions,
    qcResults,
    qcDays,
}: QualityControlPageClientProps) {
    const [activeTab, setActiveTab] = useState('overview')
    const [showEstablishLimits, setShowEstablishLimits] = useState(false)
    const [selectedAssayId, setSelectedAssayId] = useState<string | undefined>()

    // Get active session for selected assay
    const activeSessionForAssay = selectedAssayId
        ? activeSessions.find(s => s.assay_id === selectedAssayId)
        : undefined

    // Transform materials for ControlLimitsWizard (needs MaterialOption format)
    const materialOptions = materials.map(m => ({
        id: m.id,
        name: m.name,
        lot_number: m.lot_number,
        level: m.level,
    }))

    // Transform assays for ControlLimitsWizard (needs AssayOption format)
    const assayOptions = assays.map(a => ({
        id: a.id,
        name: a.name,
        units: a.units ?? undefined,
    }))

    // Get first material for LotChangeoverDialog (requires currentMaterial)
    const firstMaterial = materials[0] ? {
        id: materials[0].id,
        name: materials[0].name,
        manufacturer: materials[0].manufacturer || '',
        lot_number: materials[0].lot_number,
        level: materials[0].level,
        expiry_date: materials[0].expiry_date || '',
    } : null

    // Transform definitions for LotChangeoverDialog
    const definitionsForChangeover = definitions.map(d => ({
        id: d.id,
        mean: d.mean,
        sd: d.sd,
        cv_percent: d.cv_percent,
        assay: { id: d.assay_id, name: d.assay_name, units: d.assay_units },
    }))

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <Activity className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight">
                            Quản lý Kiểm soát Chất lượng
                        </h1>
                    </div>
                    <p className="text-muted-foreground">
                        Thiết lập và giám sát QC theo quy tắc Westgard
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Làm mới
                    </Button>
                    <Button size="sm" onClick={() => setShowEstablishLimits(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Thiết lập giới hạn
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <QCStatsCards {...stats} />

            {/* Violations Alert */}
            {stats.pendingViolations > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-5 w-5" />
                            Có {stats.pendingViolations} vi phạm QC cần xử lý
                        </CardTitle>
                        <CardDescription className="text-amber-600 dark:text-amber-500">
                            Kết quả xét nghiệm không thể được phê duyệt cho đến khi các vi phạm được giải quyết.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-300 text-amber-700 hover:bg-amber-100"
                            onClick={() => setActiveTab('violations')}
                        >
                            Xem vi phạm
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
                    <TabsTrigger value="overview" className="gap-2">
                        <BarChart3 className="h-4 w-4 hidden sm:inline" />
                        Tổng quan
                    </TabsTrigger>
                    <TabsTrigger value="materials" className="gap-2">
                        <Beaker className="h-4 w-4 hidden sm:inline" />
                        Vật liệu
                    </TabsTrigger>
                    <TabsTrigger value="definitions" className="gap-2">
                        <Settings className="h-4 w-4 hidden sm:inline" />
                        Giới hạn
                    </TabsTrigger>
                    <TabsTrigger value="sessions" className="gap-2">
                        <Activity className="h-4 w-4 hidden sm:inline" />
                        Phiên QC
                    </TabsTrigger>
                    <TabsTrigger value="violations" className="gap-2 relative">
                        <ListChecks className="h-4 w-4 hidden sm:inline" />
                        Vi phạm
                        {stats.pendingViolations > 0 && (
                            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs">
                                {stats.pendingViolations}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="gap-2">
                        <LineChart className="h-4 w-4 hidden sm:inline" />
                        Phân tích
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <QCOverviewTab
                        activeSessions={activeSessions}
                        pendingViolations={pendingViolations}
                        onViewAllSessions={() => setActiveTab('sessions')}
                        onViewAllViolations={() => setActiveTab('violations')}
                        onResolveViolation={() => setActiveTab('violations')}
                    />
                </TabsContent>

                <TabsContent value="materials">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Vật liệu QC</CardTitle>
                                    <CardDescription>
                                        Quản lý vật liệu kiểm soát chất lượng
                                    </CardDescription>
                                </div>
                                {firstMaterial && (
                                    <LotChangeoverDialog
                                        currentMaterial={firstMaterial}
                                        definitions={definitionsForChangeover}
                                        trigger={
                                            <Button size="sm">
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                                Chuyển lô
                                            </Button>
                                        }
                                    />
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <QCMaterialsTable materials={materials} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="definitions">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Giới hạn kiểm soát</CardTitle>
                                    <CardDescription>
                                        Cấu hình Mean và SD cho từng xét nghiệm
                                    </CardDescription>
                                </div>
                                <Button size="sm" onClick={() => setShowEstablishLimits(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Thiết lập mới
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <QCDefinitionsTable definitions={definitions} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sessions">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quản lý phiên QC</CardTitle>
                            <CardDescription>
                                Bắt đầu, kết thúc và giám sát các phiên QC
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <QCSessionManager
                                assays={assays.map(a => ({
                                    id: a.id,
                                    name: a.name,
                                }))}
                                activeSession={activeSessionForAssay ? {
                                    id: activeSessionForAssay.id,
                                    assay_id: activeSessionForAssay.assay_id,
                                    session_mode: activeSessionForAssay.session_mode,
                                    qc_status: activeSessionForAssay.qc_status,
                                    started_at: activeSessionForAssay.started_at,
                                    started_by: '',
                                    ended_at: null,
                                    notes: null,
                                } : undefined}
                                selectedAssayId={selectedAssayId}
                                onAssayChange={setSelectedAssayId}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="violations">
                    <Card>
                        <CardHeader>
                            <CardTitle>Vi phạm QC</CardTitle>
                            <CardDescription>
                                Danh sách vi phạm quy tắc Westgard cần xử lý
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <QCViolationsTabWithDialogs violations={pendingViolations} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="analytics">
                    <QCAnalyticsTab
                        definitions={analyticsDefinitions}
                        qcResults={qcResults}
                        qcDays={qcDays}
                    />
                </TabsContent>
            </Tabs>

            {/* Establish Limits Dialog */}
            <Dialog open={showEstablishLimits} onOpenChange={setShowEstablishLimits}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Thiết lập giới hạn kiểm soát mới</DialogTitle>
                    </DialogHeader>
                    <ControlLimitsWizard
                        assays={assayOptions}
                        materials={materialOptions}
                        onSuccess={() => {
                            setShowEstablishLimits(false)
                            window.location.reload()
                        }}
                        onCancel={() => setShowEstablishLimits(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ============================================================================
// VIOLATIONS TAB WITH EMBEDDED DIALOGS
// ============================================================================

function QCViolationsTabWithDialogs({ violations }: { violations: PendingViolation[] }) {
    if (violations.length === 0) {
        return (
            <div className="text-center py-12 text-green-600">
                <Activity className="h-12 w-12 mx-auto mb-4" />
                <p className="font-medium">Không có vi phạm nào chờ xử lý</p>
                <p className="text-sm text-muted-foreground">
                    Tất cả các phiên QC đang hoạt động bình thường
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {violations.map((violation) => (
                <div
                    key={violation.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20"
                >
                    <div className="space-y-1">
                        <div className="font-medium text-red-700">
                            {violation.assay_name}
                        </div>
                        <div className="text-sm text-red-600">
                            {violation.material_name} - {violation.material_level}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Quy tắc vi phạm: <strong>{violation.rule_violated}</strong> |
                            Giá trị: {violation.value} |
                            Z-score: {violation.z_score.toFixed(2)}
                        </div>
                    </div>
                    <ViolationResolutionDialog
                        violation={{
                            id: violation.id,
                            rule_violated: violation.rule_violated as any,
                            z_score_at_violation: violation.z_score,
                            value: violation.value,
                            mean: violation.mean,
                            sd: violation.sd,
                            assay_name: violation.assay_name,
                            created_at: violation.created_at,
                        }}
                        trigger={
                            <Button variant="destructive" size="sm">
                                Xử lý vi phạm
                            </Button>
                        }
                        onSuccess={() => window.location.reload()}
                    />
                </div>
            ))}
        </div>
    )
}
