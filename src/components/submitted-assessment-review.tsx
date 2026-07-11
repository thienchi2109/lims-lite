import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type {
    ResultAssessmentSnapshot,
    ReviewedSampleSubmission,
    SampleSubmissionReview,
} from '@/types'

interface SubmittedAssessmentReviewProps {
    review: SampleSubmissionReview | null
}

const submittedAtFormatter = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
})

function AssessmentBadge({
    assessment,
}: {
    assessment: ResultAssessmentSnapshot['assessment']
}) {
    const isWithinRange = assessment === 'within_reference_range'

    return (
        <Badge
            variant="outline"
            className={
                isWithinRange
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
            }
        >
            {isWithinRange ? 'Trong khoảng tham chiếu' : 'Ngoài khoảng tham chiếu'}
        </Badge>
    )
}

function SubmissionSnapshot({
    submission,
}: {
    submission: ReviewedSampleSubmission
}) {
    return (
        <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                    Lần gửi #{submission.submission_number}
                </p>
                <p className="text-xs text-slate-500">
                    {submittedAtFormatter.format(new Date(submission.submitted_at))}
                </p>
            </div>

            {submission.assessments.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Xét nghiệm</TableHead>
                            <TableHead>Kết quả</TableHead>
                            <TableHead>Phương pháp</TableHead>
                            <TableHead>Khoảng tham chiếu</TableHead>
                            <TableHead>Đánh giá</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {submission.assessments.map((snapshot) => (
                            <TableRow key={snapshot.id}>
                                <TableCell className="font-medium">
                                    {snapshot.assay_name}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap items-baseline gap-1">
                                        <span>{snapshot.result_value}</span>
                                        <span className="text-xs text-slate-500">
                                            {snapshot.unit ?? '—'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>{snapshot.method_name ?? '—'}</TableCell>
                                <TableCell className="whitespace-pre-line">
                                    {snapshot.reference_range ?? '—'}
                                </TableCell>
                                <TableCell>
                                    <AssessmentBadge assessment={snapshot.assessment} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <p className="rounded border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                    Lần gửi này chưa có dữ liệu đánh giá theo khoảng tham chiếu.
                </p>
            )}
        </section>
    )
}

export function SubmittedAssessmentReview({
    review,
}: SubmittedAssessmentReviewProps) {
    const activeSubmission =
        review?.submissions.find((submission) => submission.is_active) ??
        review?.submissions[0] ??
        null
    const priorSubmissions =
        review?.submissions.filter((submission) => submission.id !== activeSubmission?.id) ?? []

    return (
        <div className="space-y-3 p-3">
            <div>
                <h3 className="text-sm font-semibold text-slate-900">Đánh giá đã gửi</h3>
                <p className="text-xs text-slate-500">
                    Dữ liệu đã lưu tại thời điểm chuyên viên gửi duyệt.
                </p>
            </div>

            {activeSubmission ? (
                <SubmissionSnapshot submission={activeSubmission} />
            ) : (
                <p className="rounded border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                    Chưa có đánh giá đã gửi cho mẫu này.
                </p>
            )}

            {priorSubmissions.length > 0 && (
                <details className="border-t border-slate-200 pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                        Lịch sử đánh giá ({priorSubmissions.length})
                    </summary>
                    <div className="mt-3 space-y-4">
                        {priorSubmissions.map((submission) => (
                            <SubmissionSnapshot key={submission.id} submission={submission} />
                        ))}
                    </div>
                </details>
            )}
        </div>
    )
}
