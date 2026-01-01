'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ResolveViolationSchema, type ResolveViolation, type WestgardRule } from '@/types/qc'
import { resolveViolation } from '@/app/actions/qc-violations'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion'
import { AlertTriangle, CheckCircle2, Loader2, Wrench, BookOpen } from 'lucide-react'
import { toast } from 'sonner'

// ============================================================================
// TROUBLESHOOTING GUIDANCE PER RULE TYPE
// ============================================================================

const RULE_GUIDANCE: Record<WestgardRule, {
    description: string
    errorType: string
    possibleCauses: string[]
    correctiveActions: string[]
}> = {
    '1-2s': {
        description: 'Cảnh báo: Kết quả vượt ±2SD',
        errorType: 'Cảnh báo (không từ chối)',
        possibleCauses: [
            'Biến động bình thường của phương pháp',
            'Bắt đầu dịch chuyển nhỏ',
        ],
        correctiveActions: [
            'Theo dõi chặt chẽ kết quả tiếp theo',
            'Kiểm tra lại nếu vi phạm lặp lại',
        ],
    },
    '1-3s': {
        description: 'Từ chối: Kết quả vượt ±3SD',
        errorType: 'Sai số ngẫu nhiên',
        possibleCauses: [
            'Pipet không chính xác',
            'Mẫu QC bị lỗi hoặc hết hạn',
            'Lỗi kỹ thuật viên',
            'Sự cố thiết bị tạm thời',
        ],
        correctiveActions: [
            'Chạy lại mẫu QC với ống mới',
            'Kiểm tra ngày hết hạn QC material',
            'Kiểm tra kỹ thuật pipet',
            'Kiểm tra và hiệu chuẩn thiết bị',
        ],
    },
    '2-2s': {
        description: 'Từ chối: 2 kết quả liên tiếp cùng phía vượt 2SD',
        errorType: 'Sai số hệ thống',
        possibleCauses: [
            'Hiệu chuẩn bị lệch',
            'Thay đổi lô thuốc thử',
            'Thay đổi điều kiện môi trường',
            'Vấn đề với QC material',
        ],
        correctiveActions: [
            'Hiệu chuẩn lại thiết bị',
            'Kiểm tra lô thuốc thử (mới thay?)',
            'Kiểm tra nhiệt độ phòng và độ ẩm',
            'Thử QC material từ lô khác',
        ],
    },
    'R-4s': {
        description: 'Từ chối: Khoảng cách giữa 2 mức QC vượt 4SD',
        errorType: 'Sai số ngẫu nhiên',
        possibleCauses: [
            'Lỗi pipet (hút sai lượng)',
            'Mẫu bị trộn lẫn',
            'Sự cố cơ học thiết bị',
        ],
        correctiveActions: [
            'Kiểm tra pipet và tip',
            'Chạy lại cả 2 mức QC',
            'Kiểm tra hệ thống hút mẫu thiết bị',
        ],
    },
    '4-1s': {
        description: 'Từ chối: 4 kết quả liên tiếp cùng phía vượt 1SD',
        errorType: 'Xu hướng lệch (drift)',
        possibleCauses: [
            'Hiệu chuẩn đang dịch chuyển dần',
            'Thuốc thử đang xuống cấp',
            'Thay đổi môi trường từ từ',
        ],
        correctiveActions: [
            'Hiệu chuẩn lại thiết bị',
            'Thay thuốc thử mới',
            'Kiểm tra điều kiện bảo quản thuốc thử',
            'Đánh giá lại giới hạn kiểm soát',
        ],
    },
    '10-x': {
        description: 'Từ chối: 10 kết quả liên tiếp cùng phía mean',
        errorType: 'Dịch chuyển hệ thống (shift)',
        possibleCauses: [
            'Hiệu chuẩn đã bị lệch hoàn toàn',
            'Thay đổi lô thuốc thử lớn',
            'Thay đổi phương pháp hoặc thiết bị',
            'Giới hạn kiểm soát không còn phù hợp',
        ],
        correctiveActions: [
            'Hiệu chuẩn lại ngay lập tức',
            'Xem xét thiết lập lại giới hạn kiểm soát',
            'Đánh giá toàn bộ quy trình xét nghiệm',
            'Liên hệ nhà cung cấp thiết bị nếu cần',
        ],
    },
}

// ============================================================================
// TYPES
// ============================================================================

interface ViolationData {
    id: string
    rule_violated: WestgardRule
    z_score_at_violation: number
    value?: number
    mean?: number
    sd?: number
    assay_name?: string
    created_at: string
}

interface ViolationResolutionDialogProps {
    violation: ViolationData
    onSuccess?: () => void
    trigger?: React.ReactNode
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ViolationResolutionDialog({
    violation,
    onSuccess,
    trigger,
}: ViolationResolutionDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<ResolveViolation>({
        resolver: zodResolver(ResolveViolationSchema),
        defaultValues: {
            violation_id: violation.id,
            corrective_action: '',
        },
    })

    const guidance = RULE_GUIDANCE[violation.rule_violated]
    const errors = form.formState.errors

    const handleSubmit = async (data: ResolveViolation) => {
        setIsSubmitting(true)
        try {
            const result = await resolveViolation(data)

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success('Đã xử lý vi phạm QC thành công')
            setIsOpen(false)
            form.reset()
            onSuccess?.()
        } catch (error) {
            toast.error('Không thể xử lý vi phạm QC')
            console.error('Resolve violation error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="destructive" size="sm">
                        <Wrench className="mr-2 h-4 w-4" />
                        Xử lý vi phạm
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Xử lý vi phạm QC - Quy tắc {violation.rule_violated}
                    </DialogTitle>
                    <DialogDescription>
                        Nhập hành động khắc phục đã thực hiện. Yêu cầu bắt buộc trước khi phê duyệt kết quả.
                    </DialogDescription>
                </DialogHeader>

                {/* Violation Details */}
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="font-medium">Chi tiết vi phạm</span>
                        <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {violation.rule_violated}
                        </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span className="text-muted-foreground">Z-Score:</span>
                            <span className="ml-2 font-mono font-medium">
                                {violation.z_score_at_violation.toFixed(2)}
                            </span>
                        </div>
                        {violation.value !== undefined && (
                            <div>
                                <span className="text-muted-foreground">Giá trị:</span>
                                <span className="ml-2 font-mono">{violation.value}</span>
                            </div>
                        )}
                        {violation.assay_name && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground">Xét nghiệm:</span>
                                <span className="ml-2">{violation.assay_name}</span>
                            </div>
                        )}
                        <div className="col-span-2">
                            <span className="text-muted-foreground">Loại sai số:</span>
                            <span className="ml-2 font-medium text-destructive">
                                {guidance.errorType}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Troubleshooting Guidance */}
                <Accordion type="single" collapsible defaultValue="guidance">
                    <AccordionItem value="guidance">
                        <AccordionTrigger className="text-sm font-medium">
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                Hướng dẫn khắc phục sự cố
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium mb-2">Nguyên nhân có thể:</p>
                                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                                    {guidance.possibleCauses.map((cause, idx) => (
                                        <li key={idx}>{cause}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <p className="text-sm font-medium mb-2">Hành động khắc phục đề xuất:</p>
                                <ul className="text-sm space-y-1 ml-4 list-disc">
                                    {guidance.correctiveActions.map((action, idx) => (
                                        <li key={idx} className="text-primary">{action}</li>
                                    ))}
                                </ul>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                {/* Corrective Action Form */}
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="corrective-action" className="flex items-center gap-1">
                                Hành động khắc phục đã thực hiện
                                <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="corrective-action"
                                {...form.register('corrective_action')}
                                placeholder="Mô tả chi tiết hành động khắc phục đã thực hiện (tối thiểu 10 ký tự)..."
                                rows={4}
                                className={errors.corrective_action ? 'border-destructive' : ''}
                            />
                            {errors.corrective_action && (
                                <p className="text-sm text-destructive">
                                    {errors.corrective_action.message}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Ghi chú sẽ được lưu vào hồ sơ kiểm toán. Vui lòng mô tả đầy đủ các bước đã thực hiện.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Xác nhận xử lý
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
