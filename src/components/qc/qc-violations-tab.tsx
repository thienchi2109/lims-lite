'use client'

import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PendingViolation } from './qc-overview-tab'

interface QCViolationsTabProps {
    violations: PendingViolation[]
    onResolveViolation: (violation: PendingViolation) => void
}

export function QCViolationsTab({ violations, onResolveViolation }: QCViolationsTabProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Vi phạm QC</CardTitle>
                <CardDescription>
                    Danh sách vi phạm quy tắc Westgard cần xử lý
                </CardDescription>
            </CardHeader>
            <CardContent>
                {violations.length === 0 ? (
                    <div className="text-center py-12 text-green-600">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4" />
                        <p className="font-medium">Không có vi phạm nào chờ xử lý</p>
                        <p className="text-sm text-muted-foreground">
                            Tất cả các phiên QC đang hoạt động bình thường
                        </p>
                    </div>
                ) : (
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
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => onResolveViolation(violation)}
                                >
                                    Xử lý vi phạm
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
