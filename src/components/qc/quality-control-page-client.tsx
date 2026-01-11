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
import { type QCMaterial } from './qc-materials-list'
import { type QCDefinitionWithDetails } from './qc-definitions-table'
import { ControlLimitsWizard } from './control-limits-wizard'
import { QCAnalyticsTab, type QCDefinitionForAnalytics, type QCResultDataPoint } from './qc-analytics-tab'
import { QCMaterialsTabContent } from './qc-materials-tab-content'
import { QCDefinitionsTabContent } from './qc-definitions-tab-content'
import { QCSessionsTabContent } from './qc-sessions-tab-content'
import { QCViolationsTabContent } from './qc-violations-tab-content'
import { WalkthroughTrigger } from '@/components/walkthrough'
import type { QCSessionRow } from '@/types/qc'

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
    // Definitions pagination props
    definitionsTotal: number
    definitionsPage: number
    definitionsPageSize: number
    // Materials pagination props
    materialsTotal: number
    materialsPage: number
    materialsPageSize: number
    materialsSearch: string
    materialsLevel: 'low' | 'normal' | 'high' | null
    materialsStatus: 'valid' | 'expiring_soon' | 'expired' | null
    // Sessions pagination props
    sessionsData: QCSessionRow[]
    sessionsTotal: number
    sessionsTotalPages: number
    sessionsPage: number
    sessionsPageSize: number
    sessionsStatus?: 'pending' | 'pass' | 'warning' | 'blocked' | 'resolved'
    sessionsMode?: 'daily' | 'batch' | 'shift'
    sessionsAssay?: string
    sessionsSpecialty?: string
    sessionsActiveOnly: boolean
    sessionsSearch?: string
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
    definitionsTotal,
    definitionsPage,
    definitionsPageSize,
    materialsTotal,
    materialsPage,
    materialsPageSize,
    materialsSearch,
    materialsLevel,
    materialsStatus,
    sessionsData,
    sessionsTotal,
    sessionsTotalPages,
    sessionsPage,
    sessionsPageSize,
    sessionsStatus,
    sessionsMode,
    sessionsAssay,
    sessionsSpecialty,
    sessionsActiveOnly,
    sessionsSearch,
}: QualityControlPageClientProps) {
    const [activeTab, setActiveTab] = useState('overview')
    const [showEstablishLimits, setShowEstablishLimits] = useState(false)

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
                <TabsList id="tour-iqc-mgr-tabs" className="grid w-full grid-cols-6">
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
                    <QCMaterialsTabContent
                        materials={materials}
                        definitions={definitions}
                        total={materialsTotal}
                        page={materialsPage}
                        pageSize={materialsPageSize}
                        search={materialsSearch}
                        level={materialsLevel}
                        status={materialsStatus}
                    />
                </TabsContent>

                <TabsContent value="definitions">
                    <QCDefinitionsTabContent
                        definitions={definitions}
                        total={definitionsTotal}
                        page={definitionsPage}
                        pageSize={definitionsPageSize}
                        onEstablishLimits={() => setShowEstablishLimits(true)}
                    />
                </TabsContent>

                <TabsContent value="sessions">
                    <QCSessionsTabContent
                        specialties={specialties}
                        assays={assays}
                        sessionsData={sessionsData}
                        sessionsTotal={sessionsTotal}
                        sessionsTotalPages={sessionsTotalPages}
                        sessionsPage={sessionsPage}
                        sessionsPageSize={sessionsPageSize}
                    />
                </TabsContent>

                <TabsContent value="violations">
                    <QCViolationsTabContent violations={pendingViolations} />
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
