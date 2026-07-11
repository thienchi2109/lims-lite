import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSamplesForApprovalCount, getSamplesWithTab } from '@/app/actions/sample-approvals'
import { getSample } from '@/app/actions/samples'
import { getResultsBySample } from '@/app/actions/results'
import { getSampleSubmissionReview } from '@/app/actions/submission-reviews'
import { DashboardHeader } from '@/components/dashboard-header'
import type { ResultWithAssay, SampleSubmissionReview } from '@/types'
import { ApprovalTabsClient } from '@/components/approval-tabs-client'
import { ApprovalMobileLayout } from '@/components/approval-mobile-layout'
import { ApprovalLayoutSwitcher } from '@/components/approval-layout-switcher'
import { ApprovalPageHeader } from '@/components/approval-page-header'
import { resolveApprovalDeepLink } from '@/lib/approval-queue-url'

interface ApprovalsPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
    const resolvedParams = await searchParams
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Verify user is manager
    const { data: userData } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'manager') {
        redirect('/analyst')
    }

    // Parse search params
    const sampleId = resolvedParams.sampleId as string | undefined
    const tab = (resolvedParams.tab as 'review' | 'completed') || 'review'

    // Fetch samples based on tab
    const { data: samples, error } = await getSamplesWithTab(tab)
    const queueSamples = samples ?? []

    const selection = error
        ? { selectedSampleId: sampleId ?? null, redirectUrl: null }
        : resolveApprovalDeepLink({
            pathname: '/manager/approvals',
            searchParams: resolvedParams,
            tab,
            sampleId,
            samples: queueSamples,
        })

    if (selection.redirectUrl) {
        redirect(selection.redirectUrl)
    }

    // Fetch review samples count for badge (realtime client will keep it fresh)
    const { data: reviewCountData } = await getSamplesForApprovalCount()
    const reviewCount = reviewCountData ?? 0

    // Fetch selected sample and results if ID is present
    let selectedSample = null
    let results: ResultWithAssay[] = []
    let submissionReview: SampleSubmissionReview = { submissions: [] }
    let sampleLoadError: string | null = null

    if (selection.selectedSampleId) {
        const { data: sampleData } = await getSample(selection.selectedSampleId)
        if (sampleData) {
            selectedSample = sampleData
            const [
                { data: resultsData },
                { data: submissionReviewData, error: submissionReviewError },
            ] = await Promise.all([
                getResultsBySample(selection.selectedSampleId),
                getSampleSubmissionReview(selection.selectedSampleId),
            ])
            if (resultsData) {
                results = resultsData
            }
            if (submissionReviewData) {
                submissionReview = submissionReviewData
            }
            if (submissionReviewError) {
                sampleLoadError = submissionReviewError
            }
        }
    }

    const approvalHeaderProps = {
        samplesCount: queueSamples.length,
        tab,
    }
    const approvalErrorMessage = error ? `Lỗi khi tải hàng đợi phê duyệt: ${error}` : null

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <DashboardHeader 
                subtitle="Phê duyệt kết quả"
                user={userData}
                className="shrink-0"
            />

            <main className="flex-1 flex flex-col min-h-0 p-2 sm:px-4 gap-2">
                <ApprovalLayoutSwitcher
                    initial={
                        approvalErrorMessage ? (
                            <ApprovalErrorView
                                {...approvalHeaderProps}
                                message={approvalErrorMessage}
                            />
                        ) : (
                            <ApprovalInitialView {...approvalHeaderProps} />
                        )
                    }
                    desktop={
                        approvalErrorMessage ? (
                            <ApprovalErrorView
                                {...approvalHeaderProps}
                                message={approvalErrorMessage}
                            />
                        ) : (
                            <div className="flex flex-col flex-1 min-h-0">
                                <Suspense fallback={<ApprovalQueueFallback />}>
                                    <ApprovalTabsClient
                                        tab={tab}
                                        samples={queueSamples}
                                        reviewCount={reviewCount}
                                        selectedSampleId={selection.selectedSampleId ?? undefined}
                                        initialSample={selectedSample}
                                        initialResults={results}
                                        initialSubmissionReview={submissionReview}
                                        initialSampleLoadError={sampleLoadError}
                                    />
                                </Suspense>
                            </div>
                        )
                    }
                    mobile={
                        approvalErrorMessage ? (
                            <ApprovalErrorView
                                {...approvalHeaderProps}
                                message={approvalErrorMessage}
                            />
                        ) : (
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                <Suspense fallback={<ApprovalQueueFallback />}>
                                    <ApprovalMobileLayout
                                        samples={queueSamples}
                                        selectedSample={selectedSample}
                                        results={results}
                                        submissionReview={submissionReview}
                                        initialSampleLoadError={sampleLoadError}
                                        tab={tab}
                                        reviewCount={reviewCount}
                                    />
                                </Suspense>
                            </div>
                        )
                    }
                />
            </main>
        </div>
    )
}

function ApprovalInitialView({
    tab,
    samplesCount,
}: {
    tab: 'review' | 'completed'
    samplesCount: number
}) {
    return (
        <div className="flex flex-1 min-h-0 flex-col gap-2">
            <ApprovalPageHeader samplesCount={samplesCount} tab={tab} />
            <ApprovalQueueFallback />
        </div>
    )
}

function ApprovalErrorView({
    tab,
    samplesCount,
    message,
}: {
    tab: 'review' | 'completed'
    samplesCount: number
    message: string
}) {
    return (
        <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto">
            <ApprovalPageHeader samplesCount={samplesCount} tab={tab} />
            <div className="text-center py-8 text-destructive bg-white dark:bg-slate-900 rounded-lg border">
                {message}
            </div>
        </div>
    )
}

function ApprovalQueueFallback() {
    return (
        <div className="text-center py-8 text-slate-500 bg-white dark:bg-slate-900 rounded-lg border">
            Đang tải hàng đợi phê duyệt...
        </div>
    )
}
