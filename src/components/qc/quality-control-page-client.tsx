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
import { QCMaterialsList, type QCMaterial } from './qc-materials-list'
import { QCDefinitionsTable, type QCDefinitionWithDetails } from './qc-definitions-table'
import { QCSessionsTable } from './qc-sessions-table'
import { ControlLimitsWizard } from './control-limits-wizard'
import { LotChangeoverDialog } from './lot-changeover-dialog'
import { QCMaterialDialog } from './qc-material-dialog'
import { ViolationResolutionDialog } from './violation-resolution-dialog'
import { QCAnalyticsTab, type QCDefinitionForAnalytics, type QCResultDataPoint } from './qc-analytics-tab'
import { WalkthroughTrigger } from '@/components/walkthrough'

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

interface Specialty {
    id: string
    name: string
}

interface QualityControlPageClientProps {
    stats: Stats
    materials: QCMaterial[]
    definitions: QCDefinitionWithDetails[]
    activeSessions: ActiveSession[]
    pendingViolations: PendingViolation[]
    assays: Assay[]
    specialties: Specialty[]
    analyticsDefinitions: QCDefinitionForAnalytics[]
    qcResults: Record<string, QCResultDataPoint[]>
    qcDays: string
    // Materials pagination props
    materialsTotal: number
    materialsPage: number
    materialsPageSize: number
    materialsSearch: string
    materialsLevel: 'low' | 'normal' | 'high' | null
    materialsStatus: 'valid' | 'expiring_soon' | 'expired' | null
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
    specialties,
    analyticsDefinitions,
    qcResults,
    qcDays,
    materialsTotal,
    materialsPage,
    materialsPageSize,
    materialsSearch,
    materialsLevel,
    materialsStatus,
}: QualityControlPageClientProps) {
    const [activeTab, setActiveTab] = useState('overview')
    const [showEstablishLimits, setShowEstablishLimits] = useState(false)
    const [showAddMaterial, setShowAddMaterial] = useState(false)

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
            <div id="tour-iqc-mgr-header" className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <Activity className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight">
                            Quản lý Kiểm soát Chất lượng
                        </h1>
                        <WalkthroughTrigger tourId="iqc-manager" />
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
                    <Button id="tour-iqc-mgr-establish-limits" size="sm" onClick={() => setShowEstablishLimits(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Thiết lập giới hạn
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <QCStatsCards {...stats} />

            {/* Violations Alert */}
            {stats.pendingViolations > 0 && (
                <Card id="tour-iqc-mgr-violations-alert" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
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
                <TabsList id="tour-iqc-mgr-tabs" className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
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
                    <TabsTrigger id="tour-iqc-mgr-sessions" value="sessions" className="gap-2">
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
                                <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={() => setShowAddMaterial(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Thêm vật liệu
                                    </Button>
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
                            </div>
                        </CardHeader>
                        <CardContent>
                            <QCMaterialsList
                                materials={materials}
                                total={materialsTotal}
                                page={materialsPage}
                                pageSize={materialsPageSize}
                                search={materialsSearch}
                                level={materialsLevel}
                                status={materialsStatus}
                            />
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
                                Xem, lọc và quản lý tất cả các phiên QC
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <QCSessionsTable
                                specialties={specialties}
                                assays={assays.map(a => ({ id: a.id, name: a.name }))}
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

            {/* Add Material Dialog */}
            <QCMaterialDialog
                open={showAddMaterial}
                onOpenChange={setShowAddMaterial}
                mode="create"
            />
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
                    id="tour-iqc-mgr-resolve"
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
