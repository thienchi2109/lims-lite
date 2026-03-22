import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSamplesForApprovalCount, getSamplesWithTab } from '@/app/actions/sample-approvals'
import { getSample } from '@/app/actions/samples'
import { getResultsBySample } from '@/app/actions/results'
import { DashboardHeader } from '@/components/dashboard-header'
import type { ResultWithAssay } from '@/types'
import { ApprovalTabsClient } from '@/components/approval-tabs-client'
import { ApprovalPageHeader } from './approval-page-header'
import { ApprovalMobileLayout } from '@/components/approval-mobile-layout'
import { MobileOnly } from '@/components/mobile-only'

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

    // Fetch review samples count for badge (realtime client will keep it fresh)
    const { data: reviewCountData } = await getSamplesForApprovalCount()
    const reviewCount = reviewCountData ?? 0

    // Fetch selected sample and results if ID is present
    let selectedSample = null
    let results: ResultWithAssay[] = []

    if (sampleId) {
        const { data: sampleData } = await getSample(sampleId)
        if (sampleData) {
            selectedSample = sampleData
            const { data: resultsData } = await getResultsBySample(sampleId)
            if (resultsData) {
                results = resultsData
            }
        }
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <DashboardHeader 
                subtitle="Phê duyệt kết quả"
                user={userData}
                className="shrink-0"
            />

            <main className="flex-1 flex flex-col min-h-0 p-2 sm:px-4 gap-2">
                <ApprovalPageHeader
                    samplesCount={samples?.length || 0}
                    tab={tab}
                />

                {/* ═══ Desktop Layout (xl and above) ═══ */}
                <div className="hidden xl:flex xl:flex-col xl:flex-1 xl:min-h-0">
                    {error ? (
                        <div className="text-center py-8 text-destructive bg-white dark:bg-slate-900 rounded-lg border">
                            Lỗi khi tải hàng đợi phê duyệt: {error}
                        </div>
                    ) : (
                        <Suspense fallback={<ApprovalQueueFallback />}>
                            <ApprovalTabsClient
                                tab={tab}
                                samples={samples || []}
                                reviewCount={reviewCount}
                                selectedSampleId={selectedSample?.id}
                                initialSample={selectedSample}
                                initialResults={results}
                            />
                        </Suspense>
                    )}
                </div>

                {/* ═══ Mobile Layout (below xl) ═══ */}
                <MobileOnly breakpoint={1280}>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {error ? (
                            <div className="text-center py-8 text-destructive bg-white dark:bg-slate-900 rounded-lg border">
                                Lỗi khi tải hàng đợi phê duyệt: {error}
                            </div>
                        ) : (
                            <Suspense fallback={<ApprovalQueueFallback />}>
                                <ApprovalMobileLayout
                                    samples={samples || []}
                                    selectedSample={selectedSample}
                                    results={results}
                                    tab={tab}
                                    reviewCount={reviewCount}
                                />
                            </Suspense>
                        )}
                    </div>
                </MobileOnly>
            </main>
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
