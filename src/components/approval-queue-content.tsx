import { ApprovalInspectorColumn } from '@/components/approval-inspector-column'
import { ApprovalQueueTable } from '@/components/approval-queue-table'
import { DesktopMasterDetailShell } from '@/components/desktop-master-detail-shell'
import type {
    ApprovalQueueSample,
    ResultWithAssay,
    SampleSubmissionReview,
    SampleWithUser,
} from '@/types'

interface ApprovalQueueContentProps {
    samples: ApprovalQueueSample[]
    selectedSampleId: string | null
    onSelectSample: (sampleId: string) => void
    sample: SampleWithUser | null
    results: ResultWithAssay[]
    submissionReview: SampleSubmissionReview | null
    isLoadingSample: boolean
    sampleLoadError: string | null
}

export function ApprovalQueueContent({
    samples,
    selectedSampleId,
    onSelectSample,
    sample,
    results,
    submissionReview,
    isLoadingSample,
    sampleLoadError,
}: ApprovalQueueContentProps) {
    return (
        <DesktopMasterDetailShell
            workspaceTestId="approvals-workspace"
            gridColumnTestId="approvals-grid-column"
            inspectorColumnTestId="approvals-inspector-column"
            inspectorId="tour-approval-detail"
            inspectorClassName="min-h-[24rem] overflow-hidden border-t pt-2 lg:min-h-0 lg:border-t-0 lg:pt-0"
            left={(
                <div
                    id="tour-approval-queue"
                    className="h-[40vh] min-h-[250px] shrink-0 lg:h-full lg:min-h-0 flex flex-col"
                >
                    <ApprovalQueueTable
                        data={samples}
                        selectedSampleId={selectedSampleId}
                        onSelectSample={onSelectSample}
                    />
                </div>
            )}
            right={(
                <ApprovalInspectorColumn
                    sample={sample}
                    results={results}
                    submissionReview={submissionReview}
                    isLoadingSample={isLoadingSample}
                    loadErrorMessage={sampleLoadError}
                />
            )}
        />
    )
}
