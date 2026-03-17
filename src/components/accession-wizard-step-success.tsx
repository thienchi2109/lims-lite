'use client'

/**
 * AccessionWizardStepSuccess
 *
 * Wizard Step 4: Success state after sample accession is saved.
 * Shows sample code, summary info, and next actions.
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, Plus, Printer, Home } from 'lucide-react'
import Link from 'next/link'

interface StepSuccessProps {
    successMessage: string
    clientName: string
    sampleType: string
    testCount: number
    onNewAccession: () => void
}

export function AccessionWizardStepSuccess({
    successMessage,
    clientName,
    sampleType,
    testCount,
    onNewAccession,
}: StepSuccessProps) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
            <Card className="w-full max-w-sm">
                <CardContent className="flex flex-col items-center gap-5 pt-6">
                    {/* Success icon */}
                    <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
                    </div>

                    {/* Title */}
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-foreground">
                            Tiếp nhận mẫu thành công!
                        </h2>
                        <p className="mt-1 text-sm font-medium text-primary">
                            {successMessage}
                        </p>
                    </div>

                    <Separator />

                    {/* Summary rows */}
                    <div className="flex w-full flex-col gap-2">
                        <SummaryRow label="Khách hàng" value={clientName} />
                        <SummaryRow label="Loại mẫu" value={sampleType} />
                        <SummaryRow label="Số xét nghiệm" value={String(testCount)} />
                    </div>

                    <Separator />

                    {/* Action buttons */}
                    <div className="flex w-full flex-col gap-2.5">
                        <Button
                            type="button"
                            onClick={onNewAccession}
                            className="min-h-11 w-full gap-2"
                        >
                            <Plus className="size-4" />
                            Tiếp nhận mẫu mới
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 w-full gap-2"
                            disabled
                        >
                            <Printer className="size-4" />
                            In phiếu yêu cầu
                        </Button>
                        <Button
                            asChild
                            variant="ghost"
                            className="min-h-11 w-full gap-2 text-muted-foreground"
                        >
                            <Link href="/analyst">
                                <Home className="size-4" />
                                Quay lại trang chủ
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

/** Simple label–value row for success summary */
function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
    )
}
