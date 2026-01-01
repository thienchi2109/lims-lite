'use client'

import { useMemo } from 'react'
import { Activity, AlertTriangle, CheckCircle2, TrendingUp, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
    calculateSigmaMetrics,
    getRecommendedQCFrequency,
    type SigmaQualityLevel,
} from '@/lib/qc/sigma-metrics'

// ============================================================================
// TYPES
// ============================================================================

interface SigmaDashboardProps {
    /** Lab mean from QC results */
    labMean: number
    /** Peer group mean (target/reference value) */
    peerGroupMean: number
    /** Standard deviation */
    sd: number
    /** Total Allowable Error percentage */
    tea: number
    /** Assay name for display */
    assayName: string
    /** Material info for display */
    materialInfo: string
}

// ============================================================================
// HELPERS
// ============================================================================

const qualityColors: Record<SigmaQualityLevel, { bg: string; text: string; border: string }> = {
    'world-class': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'excellent': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    'good': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'marginal': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    'poor': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'unacceptable': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

const qualityLabels: Record<SigmaQualityLevel, string> = {
    'world-class': 'Đẳng cấp thế giới',
    'excellent': 'Xuất sắc',
    'good': 'Tốt',
    'marginal': 'Biên',
    'poor': 'Kém',
    'unacceptable': 'Không chấp nhận',
}

function getSigmaProgressValue(sigma: number): number {
    // Map sigma 0-6+ to progress 0-100
    return Math.min(Math.max((sigma / 6) * 100, 0), 100)
}

function getSigmaIcon(level: SigmaQualityLevel) {
    switch (level) {
        case 'world-class':
        case 'excellent':
            return <Zap className="h-5 w-5" />
        case 'good':
            return <CheckCircle2 className="h-5 w-5" />
        case 'marginal':
            return <TrendingUp className="h-5 w-5" />
        case 'poor':
        case 'unacceptable':
            return <AlertTriangle className="h-5 w-5" />
    }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SigmaDashboard({
    labMean,
    peerGroupMean,
    sd,
    tea,
    assayName,
    materialInfo,
}: SigmaDashboardProps) {
    const metrics = useMemo(() => {
        return calculateSigmaMetrics({ labMean, peerGroupMean, sd, tea })
    }, [labMean, peerGroupMean, sd, tea])

    const qcFrequency = useMemo(() => {
        if (!metrics) return null
        return getRecommendedQCFrequency(metrics.sigma)
    }, [metrics])

    if (!metrics) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Đo lường Sigma
                    </CardTitle>
                    <CardDescription>
                        Không thể tính toán - thiếu dữ liệu hoặc giá trị không hợp lệ
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const colors = qualityColors[metrics.qualityLevel]

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Sigma Gauge Card */}
            <Card className={`${colors.bg} ${colors.border} border-2`}>
                <CardHeader className="pb-2">
                    <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
                        {getSigmaIcon(metrics.qualityLevel)}
                        Sigma: {metrics.sigma.toFixed(2)}σ
                    </CardTitle>
                    <CardDescription className={colors.text}>
                        {assayName} - {materialInfo}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Sigma Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Mức chất lượng</span>
                            <Badge className={`${colors.bg} ${colors.text} border ${colors.border}`}>
                                {qualityLabels[metrics.qualityLevel]}
                            </Badge>
                        </div>
                        <Progress
                            value={getSigmaProgressValue(metrics.sigma)}
                            className="h-3"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0σ</span>
                            <span>3σ (Biên)</span>
                            <span>6σ+</span>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground">TEa%</p>
                            <p className="font-mono font-semibold">{metrics.tea.toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground">Bias%</p>
                            <p className="font-mono font-semibold">{metrics.bias.toFixed(2)}%</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground">CV%</p>
                            <p className="font-mono font-semibold">{metrics.cv.toFixed(2)}%</p>
                        </div>
                    </div>

                    {/* Description */}
                    <p className={`text-sm ${colors.text}`}>{metrics.description}</p>
                </CardContent>
            </Card>

            {/* Recommendations Card */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        Khuyến nghị QC
                    </CardTitle>
                    <CardDescription>
                        Dựa trên mức Sigma hiện tại
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Recommended Rules */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Quy tắc Westgard áp dụng:</p>
                        <div className="flex flex-wrap gap-2">
                            {metrics.recommendedRules.map((rule) => (
                                <Badge key={rule} variant="secondary">
                                    {rule}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* QC Frequency */}
                    {qcFrequency && (
                        <div className="space-y-2 pt-2 border-t">
                            <p className="text-sm font-medium">Tần suất QC:</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border p-3 text-center">
                                    <p className="text-2xl font-bold text-primary">
                                        {qcFrequency.runsPerDay}
                                    </p>
                                    <p className="text-xs text-muted-foreground">lần/ngày</p>
                                </div>
                                <div className="rounded-lg border p-3 text-center">
                                    <p className="text-2xl font-bold text-primary">
                                        {qcFrequency.levelsPerRun}
                                    </p>
                                    <p className="text-xs text-muted-foreground">mức/lần</p>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {qcFrequency.description}
                            </p>
                        </div>
                    )}

                    {/* Formula Reference */}
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                        <p className="font-mono">σ = (TEa% - |Bias%|) / CV%</p>
                        <p className="mt-1">
                            σ = ({metrics.tea}% - {Math.abs(metrics.bias).toFixed(2)}%) / {metrics.cv.toFixed(2)}% = {metrics.sigma.toFixed(2)}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
