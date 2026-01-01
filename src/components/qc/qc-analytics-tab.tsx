'use client'

import { useState, useMemo } from 'react'
import { BarChart3, LineChart } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { LeveyJenningsChart } from './levey-jennings-chart'
import { SigmaDashboard } from './sigma-dashboard'
import type { QCResultStatus } from '@/types/qc'

// ============================================================================
// TYPES
// ============================================================================

export interface QCResultDataPoint {
    id: string
    value: number
    z_score: number | null
    status: QCResultStatus
    measured_at: string
    rule_violated: string | null
}

export interface QCDefinitionForAnalytics {
    id: string
    mean: number
    sd: number
    cv_percent: number | null
    assay_id: string
    assay_name: string
    assay_units: string | null
    material_id: string
    material_name: string
    material_level: string
    material_lot: string
    tea_percent: number | null
}

export interface QCAnalyticsTabProps {
    definitions: QCDefinitionForAnalytics[]
    qcResults: Record<string, QCResultDataPoint[]> // definitionId -> results
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCAnalyticsTab({ definitions, qcResults }: QCAnalyticsTabProps) {
    const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>(
        definitions[0]?.id ?? ''
    )

    // Get selected definition
    const selectedDefinition = useMemo(() => {
        return definitions.find(d => d.id === selectedDefinitionId)
    }, [definitions, selectedDefinitionId])

    // Get results for selected definition
    const selectedResults = useMemo(() => {
        if (!selectedDefinitionId) return []
        return qcResults[selectedDefinitionId] ?? []
    }, [qcResults, selectedDefinitionId])

    // Transform results for Levey-Jennings chart
    const chartDataPoints = useMemo(() => {
        return selectedResults.map(r => ({
            id: r.id,
            value: r.value,
            zScore: r.z_score,
            status: r.status,
            measuredAt: r.measured_at,
            ruleViolated: r.rule_violated,
        }))
    }, [selectedResults])

    // Calculate lab mean from actual results (for Sigma calculation)
    const labMean = useMemo(() => {
        if (selectedResults.length === 0) return null
        const sum = selectedResults.reduce((acc, r) => acc + r.value, 0)
        return sum / selectedResults.length
    }, [selectedResults])

    if (definitions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Phân tích QC
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                        <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Chưa có giới hạn kiểm soát nào được thiết lập.</p>
                        <p className="text-sm">Thiết lập giới hạn kiểm soát để xem phân tích.</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Definition Selector */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <BarChart3 className="h-5 w-5" />
                        Phân tích QC
                    </CardTitle>
                    <CardDescription>
                        Biểu đồ Levey-Jennings và đo lường Six Sigma
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Label className="shrink-0">Chọn xét nghiệm:</Label>
                        <Select
                            value={selectedDefinitionId}
                            onValueChange={setSelectedDefinitionId}
                        >
                            <SelectTrigger className="w-full max-w-md">
                                <SelectValue placeholder="Chọn xét nghiệm..." />
                            </SelectTrigger>
                            <SelectContent>
                                {definitions.map((def) => (
                                    <SelectItem key={def.id} value={def.id}>
                                        {def.assay_name} - {def.material_name} ({def.material_level})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {selectedDefinition && (
                <>
                    {/* Levey-Jennings Chart */}
                    <LeveyJenningsChart
                        title="Biểu đồ Levey-Jennings"
                        assayName={selectedDefinition.assay_name}
                        materialInfo={`${selectedDefinition.material_name} (${selectedDefinition.material_level}) - Lô: ${selectedDefinition.material_lot}`}
                        mean={selectedDefinition.mean}
                        sd={selectedDefinition.sd}
                        units={selectedDefinition.assay_units ?? ''}
                        dataPoints={chartDataPoints}
                        height={400}
                    />

                    {/* Sigma Dashboard */}
                    {selectedDefinition.tea_percent && labMean !== null && (
                        <SigmaDashboard
                            assayName={selectedDefinition.assay_name}
                            materialInfo={`${selectedDefinition.material_name} (${selectedDefinition.material_level})`}
                            labMean={labMean}
                            peerGroupMean={selectedDefinition.mean}
                            sd={selectedDefinition.sd}
                            tea={selectedDefinition.tea_percent}
                        />
                    )}

                    {/* No TEa Warning */}
                    {!selectedDefinition.tea_percent && (
                        <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="py-4">
                                <p className="text-sm text-amber-700">
                                    <strong>Lưu ý:</strong> Chưa thiết lập TEa (Total Allowable Error) cho xét nghiệm này.
                                    Cấu hình TEa để xem đo lường Sigma.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* No Results Warning */}
                    {selectedResults.length === 0 && (
                        <Card className="border-blue-200 bg-blue-50">
                            <CardContent className="py-4">
                                <p className="text-sm text-blue-700">
                                    <strong>Thông tin:</strong> Chưa có kết quả QC nào cho xét nghiệm này.
                                    Nhập kết quả QC để xem biểu đồ.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}
