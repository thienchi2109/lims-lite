'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApprovalDialog } from '@/components/approval-dialog'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { ResultWithAssay } from '@/types'

interface ApprovalActionsProps {
    sampleId: string
    results: ResultWithAssay[]
}

export function ApprovalActions({ sampleId, results }: ApprovalActionsProps) {
    const [approveDialogOpen, setApproveDialogOpen] = useState(false)
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

    // Get results that can be approved (status='entered')
    const enteredResults = results.filter((r) => r.status === 'entered')

    // Get results that are approved (status='approved')
    const approvedResults = results.filter((r) => r.status === 'approved')

    const hasEnteredResults = enteredResults.length > 0
    const hasApprovedResults = approvedResults.length > 0

    if (!hasEnteredResults && !hasApprovedResults) {
        return null
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Approval Actions</CardTitle>
                    <CardDescription>
                        Review and approve test results or cancel existing approvals
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        {hasEnteredResults && (
                            <Button
                                onClick={() => setApproveDialogOpen(true)}
                                className="gap-2"
                                size="lg"
                            >
                                <CheckCircle2 className="h-5 w-5" />
                                Approve {enteredResults.length} Result{enteredResults.length > 1 ? 's' : ''}
                            </Button>
                        )}

                        {hasApprovedResults && (
                            <Button
                                onClick={() => setCancelDialogOpen(true)}
                                variant="destructive"
                                className="gap-2"
                                size="lg"
                            >
                                <XCircle className="h-5 w-5" />
                                Cancel Approval ({approvedResults.length})
                            </Button>
                        )}
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <p>
                            • <strong>{enteredResults.length}</strong> result{enteredResults.length !== 1 ? 's' : ''} ready for approval
                        </p>
                        <p>
                            • <strong>{approvedResults.length}</strong> result{approvedResults.length !== 1 ? 's' : ''} already approved
                        </p>
                        <p>
                            • <strong>{results.filter((r) => r.status === 'pending').length}</strong> result{results.filter((r) => r.status === 'pending').length !== 1 ? 's' : ''} pending data entry
                        </p>
                    </div>
                </CardContent>
            </Card>

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
        </>
    )
}
