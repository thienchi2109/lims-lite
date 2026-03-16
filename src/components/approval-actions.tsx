'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApprovalDialog } from '@/components/approval-dialog'
import { RejectSampleDialog } from '@/components/reject-sample-dialog'
import { DiscardSampleDialog } from '@/components/discard-sample-dialog'
import { CheckCircle2, XCircle, Ban, Trash2 } from 'lucide-react'
import type { ResultWithAssay } from '@/types'

interface ApprovalActionsProps {
    sampleId: string
    results: ResultWithAssay[]
    compact?: boolean
}

export function ApprovalActions({ sampleId, results, compact = false }: ApprovalActionsProps) {
    const [approveDialogOpen, setApproveDialogOpen] = useState(false)
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false)

    // Get results that can be approved (status='entered')
    const enteredResults = results.filter((r) => r.status === 'entered')

    // Get results that are approved (status='approved')
    const approvedResults = results.filter((r) => r.status === 'approved')

    const hasEnteredResults = enteredResults.length > 0
    const hasApprovedResults = approvedResults.length > 0
    const sampleStatus = results.length > 0 ? results[0].sample_status : null
    const isReview = sampleStatus === 'review'

    if (!hasEnteredResults && !hasApprovedResults) {
        return null
    }

    const buttonSize = compact ? 'sm' : 'lg'
    const iconSize = compact ? 'h-4 w-4' : 'h-5 w-5'

    const actionButtons = (
        <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-3'}>
            {hasEnteredResults && (
                <Button
                    id={compact ? undefined : 'tour-approve-button'}
                    onClick={() => setApproveDialogOpen(true)}
                    className="gap-1.5"
                    size={buttonSize}
                >
                    <CheckCircle2 className={iconSize} />
                    {compact ? `Duyệt (${enteredResults.length})` : `Phê duyệt ${enteredResults.length} kết quả`}
                </Button>
            )}

            {hasApprovedResults && (
                <Button
                    onClick={() => setCancelDialogOpen(true)}
                    variant="destructive"
                    className="gap-1.5"
                    size={buttonSize}
                >
                    <XCircle className={iconSize} />
                    {compact ? `Hủy (${approvedResults.length})` : `Hủy phê duyệt (${approvedResults.length})`}
                </Button>
            )}

            {isReview && (
                <>
                    <Button
                        id={compact ? undefined : 'tour-reject-button'}
                        onClick={() => setRejectDialogOpen(true)}
                        variant="secondary"
                        className="gap-1.5 border border-slate-200"
                        size={buttonSize}
                    >
                        <Ban className={iconSize} />
                        Từ chối
                    </Button>

                    <Button
                        id={compact ? undefined : 'tour-discard-button'}
                        onClick={() => setDiscardDialogOpen(true)}
                        variant="outline"
                        className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        size={buttonSize}
                    >
                        <Trash2 className={iconSize} />
                        Loại bỏ
                    </Button>
                </>
            )}
        </div>
    )

    return (
        <>
            {compact ? (
                actionButtons
            ) : (
                <Card id="tour-approval-actions">
                    <CardHeader>
                        <CardTitle>Thao tác phê duyệt</CardTitle>
                        <CardDescription>
                            Xem xét và phê duyệt kết quả xét nghiệm hoặc hủy phê duyệt hiện có
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {actionButtons}

                        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <p>
                                • <strong>{enteredResults.length}</strong> kết quả sẵn sàng phê duyệt
                            </p>
                            <p>
                                • <strong>{approvedResults.length}</strong> kết quả đã được phê duyệt
                            </p>
                            <p>
                                • <strong>{results.filter((r) => r.status === 'pending').length}</strong> kết quả đang chờ nhập liệu
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Approval Dialog */}
            <ApprovalDialog
                sampleId={sampleId}
                resultIds={enteredResults.map((r) => r.id)}
                mode="approve"
                open={approveDialogOpen}
                onOpenChange={setApproveDialogOpen}
            />

            {/* Cancel Approval Dialog */}
            <ApprovalDialog
                sampleId={sampleId}
                resultIds={approvedResults.map((r) => r.id)}
                mode="cancel"
                open={cancelDialogOpen}
                onOpenChange={setCancelDialogOpen}
            />

            {/* Reject Sample Dialog */}
            <RejectSampleDialog
                sampleId={sampleId}
                open={rejectDialogOpen}
                onOpenChange={setRejectDialogOpen}
            />

            {/* Discard Sample Dialog */}
            <DiscardSampleDialog
                sampleId={sampleId}
                open={discardDialogOpen}
                onOpenChange={setDiscardDialogOpen}
            />
        </>
    )
}
