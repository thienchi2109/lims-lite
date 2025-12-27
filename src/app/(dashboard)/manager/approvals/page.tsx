import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSamplesForApprovalCount, getSample, getSamplesWithTab } from '@/app/actions/samples'
import { getResultsBySample } from '@/app/actions/results'
import { ApprovalQueueTable } from '@/components/approval-queue-table'
import { ApprovalBottomRow } from '@/components/approval-bottom-row'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { DashboardHeader } from '@/components/dashboard-header'
import type { ResultWithAssay } from '@/types'
import { ApprovalTabsClient } from '@/components/approval-tabs-client'

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
                <div className="flex items-center justify-between shrink-0">
                    <Link href="/manager">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Quay lại Bảng điều khiển
                        </Button>
                    </Link>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {samples?.length || 0} mẫu {tab === 'review' ? 'đang chờ phê duyệt' : 'đã hoàn thành'}
                    </div>
                </div>

                {/* Top Row: Queue (Fixed Height ~50%) */}
                <div id="tour-approval-queue" className="h-[50vh] min-h-[400px] shrink-0">
                    {error ? (
                        <div className="text-center py-8 text-destructive bg-white dark:bg-slate-900 rounded-lg border">
                            Lỗi khi tải hàng đợi phê duyệt: {error}
                        </div>
                    ) : (
                        <ApprovalTabsClient
                            tab={tab}
                            samples={samples || []}
                            reviewCount={reviewCount}
                            selectedSampleId={selectedSample?.id}
                        />
                    )}
                </div>

                {/* Bottom Row: Detail & Actions (Remaining Height) */}
                <div id="tour-approval-detail" className="flex-1 min-h-0 border-t pt-4">
                    <ApprovalBottomRow
                        sample={selectedSample}
                        results={results}
                    />
                </div>
            </main>
        </div>
    )

}
