'use client'

import { Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ViolationResolutionDialog } from './violation-resolution-dialog'
import type { PendingViolation } from './qc-overview-tab'
import { WestgardRule, type WestgardRule as WestgardRuleValue } from '@/types/qc'

interface QCViolationsTabContentProps {
    violations: PendingViolation[]
}

function parseWestgardRule(rule: string): WestgardRuleValue | null {
    const parsed = WestgardRule.safeParse(rule)
    return parsed.success ? parsed.data : null
}

export function QCViolationsTabContent({ violations }: QCViolationsTabContentProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Vi phạm QC</CardTitle>
                <CardDescription>
                    Danh sách vi phạm quy tắc Westgard cần xử lý
                </CardDescription>
            </CardHeader>
            <CardContent>
                <QCViolationsList violations={violations} />
            </CardContent>
        </Card>
    )
}

function QCViolationsList({ violations }: { violations: PendingViolation[] }) {
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
            {violations.map((violation) => {
                const parsedRule = parseWestgardRule(violation.rule_violated)

                return (
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
                        {parsedRule === null ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled
                                title="Quy tắc Westgard không hợp lệ"
                            >
                                Quy tắc không hợp lệ
                            </Button>
                        ) : (
                            <ViolationResolutionDialog
                                violation={{
                                    id: violation.id,
                                    rule_violated: parsedRule,
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
                        )}
                    </div>
                )
            })}
        </div>
    )
}
