'use client'

import { AlertTriangle, Activity, Beaker, ListChecks, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

interface QCStatsCardsProps {
    totalMaterials: number
    totalDefinitions: number
    activeDefinitions: number
    activeSessions: number
    pendingViolations: number
    blockedSessions: number
}

export function QCStatsCards({
    totalMaterials,
    totalDefinitions,
    activeDefinitions,
    activeSessions,
    pendingViolations,
    blockedSessions,
}: QCStatsCardsProps) {
    return (
        <div id="tour-iqc-mgr-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                        <Beaker className="h-4 w-4" />
                        Vật liệu QC
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalMaterials}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Giới hạn đang hoạt động
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                        {activeDefinitions}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                            / {totalDefinitions}
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Phiên QC đang hoạt động
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{activeSessions}</span>
                        {blockedSessions > 0 && (
                            <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {blockedSessions} mất kiểm soát
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4" />
                        Vi phạm chờ xử lý
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${pendingViolations > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {pendingViolations}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
