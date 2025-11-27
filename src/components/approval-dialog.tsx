'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveResults, cancelApproval } from '@/app/actions/results'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface ApprovalDialogProps {
    sampleId: string
    resultIds: string[]
    mode: 'approve' | 'cancel'
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ApprovalDialog({
    sampleId,
    resultIds,
    mode,
    open,
    onOpenChange,
}: ApprovalDialogProps) {
    const [note, setNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const handleSubmit = async () => {
        if (mode === 'cancel' && note.trim().length < 3) {
            toast.error('Please provide a reason (minimum 3 characters)')
            return
        }

        setIsSubmitting(true)

        try {
            if (mode === 'approve') {
                const result = await approveResults({
                    sampleId,
                    resultIds,
                    note: note.trim() || undefined,
                })

                if (result.error) {
                    toast.error(result.error)
                } else {
                    toast.success(`Approved ${result.approvedCount} results`)
                    onOpenChange(false)
                    setNote('')
                    router.refresh()
                }
            } else {
                const result = await cancelApproval({
                    sampleId,
                    resultIds,
                    reason: note.trim(),
                })

                if (result.error) {
                    toast.error(result.error)
                } else {
                    toast.success(`Canceled approval for ${result.canceledCount} results`)
                    onOpenChange(false)
                    setNote('')
                    router.refresh()
                }
            }
        } catch (error) {
            toast.error('An unexpected error occurred')
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {mode === 'approve' ? (
                            <>
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                Approve Results
                            </>
                        ) : (
                            <>
                                <XCircle className="h-5 w-5 text-red-600" />
                                Cancel Approval
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'approve'
                            ? `You are about to approve ${resultIds.length} test result${resultIds.length > 1 ? 's' : ''}. This action will be logged in the audit trail.`
                            : `You are about to cancel approval for ${resultIds.length} test result${resultIds.length > 1 ? 's' : ''}. Please provide a reason for this action.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="note">
                            {mode === 'approve' ? 'Note (Optional)' : 'Reason (Required)'}
                        </Label>
                        <Textarea
                            id="note"
                            placeholder={
                                mode === 'approve'
                                    ? 'Add an optional note for this approval...'
                                    : 'Explain why you are canceling this approval...'
                            }
                            value={note}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                            rows={4}
                            maxLength={500}
                            required={mode === 'cancel'}
                        />
                        <p className="text-xs text-muted-foreground">
                            {note.length}/500 characters
                            {mode === 'cancel' && note.trim().length < 3 && (
                                <span className="text-red-600 ml-2">
                                    (Minimum 3 characters required)
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (mode === 'cancel' && note.trim().length < 3)}
                        variant={mode === 'approve' ? 'default' : 'destructive'}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : mode === 'approve' ? (
                            'Approve Results'
                        ) : (
                            'Cancel Approval'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
