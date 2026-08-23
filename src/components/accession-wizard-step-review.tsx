'use client'

/**
 * AccessionWizardStepReview
 *
 * Wizard Step 3: Read-only summary of customer info, sample details,
 * and selected tests. Allows jumping back to specific steps to edit.
 */

import type { Client, CreateClient, SelectedTest } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    AlertCircle,
    ArrowLeft,
    Pencil,
    Eye,
    Loader2,
    ShieldCheck,
} from 'lucide-react'

interface StepReviewProps {
    selectedClient: Client | CreateClient | null
    selectedSampleType: string
    sampleQuality: boolean | null
    receivedAt: string
    selected: SelectedTest[]
    submitError?: string | null
    onBack: () => void
    onGoToStep: (step: number) => void
    onConfirm: () => void
    isSaving: boolean
    isSaveDisabled?: boolean
}

function getSampleQualityLabel(sampleQuality: boolean | null): string {
    if (sampleQuality === null) {
        return 'Chưa chọn'
    }

    return sampleQuality ? 'Đạt' : 'Không đạt'
}

export function AccessionWizardStepReview({
    selectedClient,
    selectedSampleType,
    sampleQuality,
    receivedAt,
    selected,
    submitError,
    onBack,
    onGoToStep,
    onConfirm,
    isSaving,
    isSaveDisabled,
}: StepReviewProps) {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Thời gian hiện tại'
        try {
            return new Date(dateStr).toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })
        } catch {
            return dateStr
        }
    }

    const scrollPaddingClassName = submitError ? 'pb-40' : 'pb-24'

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className={`flex-1 overflow-y-auto px-4 ${scrollPaddingClassName}`}>
                <div className="mb-4 flex items-center gap-2">
                    <Eye className="size-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">
                        Xem lại thông tin
                    </h2>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Customer info section */}
                    <Card>
                        <CardHeader className="flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                                Thông tin khách hàng
                            </CardTitle>
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={() => onGoToStep(0)}
                                className="h-auto gap-1 p-0 text-xs"
                            >
                                <Pencil className="size-3" />
                                Chỉnh sửa
                            </Button>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <ReviewRow label="Họ và tên" value={selectedClient?.name || '—'} />
                            <ReviewRow label="Số CMND/CCCD" value={selectedClient?.id_card_num || '—'} />
                            <ReviewRow label="Giới tính" value={selectedClient?.gender || '—'} />
                            <ReviewRow
                                label="Ngày sinh"
                                value={selectedClient?.date_of_birth
                                    ? formatDate(selectedClient.date_of_birth)
                                    : '—'}
                            />
                        </CardContent>
                    </Card>

                    {/* Sample info section */}
                    <Card>
                        <CardHeader className="flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                                Thông tin mẫu
                            </CardTitle>
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={() => onGoToStep(0)}
                                className="h-auto gap-1 p-0 text-xs"
                            >
                                <Pencil className="size-3" />
                                Chỉnh sửa
                            </Button>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <ReviewRow
                                label="Loại mẫu"
                                value={
                                    <Badge variant="secondary">{selectedSampleType}</Badge>
                                }
                            />
                            <ReviewRow
                                label="Chất lượng mẫu"
                                value={getSampleQualityLabel(sampleQuality)}
                            />
                            <ReviewRow label="Thời gian nhận" value={formatDate(receivedAt)} />
                        </CardContent>
                    </Card>

                    {/* Selected tests section */}
                    <Card>
                        <CardHeader className="flex-row items-center justify-between pb-3">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                                    Xét nghiệm đã chọn
                                </CardTitle>
                                <Badge variant="secondary" className="text-xs">
                                    {selected.length}
                                </Badge>
                            </div>
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={() => onGoToStep(1)}
                                className="h-auto gap-1 p-0 text-xs"
                            >
                                <Pencil className="size-3" />
                                Chỉnh sửa
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {selected.length === 0 ? (
                                <p className="text-sm italic text-muted-foreground">
                                    Không có xét nghiệm nào được chọn.
                                </p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {selected.map((test, i) => (
                                        <div
                                            key={test.assayId}
                                            className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                                        >
                                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                {i + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium text-foreground">
                                                    {test.assayName}
                                                </div>
                                                {test.methodName && (
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        Phương pháp: {test.methodName}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Compliance note */}
                    <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>
                            Vui lòng kiểm tra kỹ tất cả thông tin trước khi nhấn
                            &quot;Xác nhận &amp; Lưu&quot;. Thông tin sau khi lưu sẽ được
                            đồng bộ lên hệ thống.
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-background/80 backdrop-blur-md">
                {submitError && (
                    <div className="px-4 pt-3">
                        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm flex items-center gap-2">
                            <AlertCircle className="size-4" />
                            {submitError}
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onBack}
                        className="min-h-11 flex-1 gap-1"
                    >
                        <ArrowLeft className="size-4" />
                        Quay lại
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSaving || isSaveDisabled}
                        className="min-h-11 flex-[1.5] gap-1"
                    >
                        {isSaving ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <>
                                <ShieldCheck className="size-4" />
                                Xác nhận &amp; Lưu
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}

/** Simple label–value row for review summaries */
function ReviewRow({
    label,
    value,
}: {
    label: string
    value: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
    )
}
