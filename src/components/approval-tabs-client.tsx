'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ApprovalQueueTable } from '@/components/approval-queue-table'
import { ApprovalBottomRow } from '@/components/approval-bottom-row'
import { type SampleStatus, type CoAReportStatus } from '@/types'
import type { ResultWithAssay, SampleWithUser } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { fetchSampleResultsClient, fetchSamplesForApprovalCountClient } from '@/lib/api-client'
import { useFaviconBadge } from '@/hooks/use-favicon-badge'
import { fetchSampleDetail } from '@/hooks/use-sample-detail'

// Type for approval queue data (matches approval-queue-table.tsx)
interface ApprovalQueueSample {
    id: string
    sample_id: string
    client_name: string | null
    status: SampleStatus
    received_at: string | null
    updated_at: string | null
    received_by_name: string | null
    total_tests: number
    entered_count: number
    approved_count: number
    pending_count: number
    coa_reports?: Array<{ status: CoAReportStatus; error_message?: string | null }> | null
}

interface ApprovalTabsClientProps {
    tab: 'review' | 'completed'
    samples: ApprovalQueueSample[]
    reviewCount: number
    selectedSampleId?: string
    initialSample: SampleWithUser | null
    initialResults: ResultWithAssay[]
}

export function ApprovalTabsClient({
    tab,
    samples,
    reviewCount,
    selectedSampleId,
    initialSample,
    initialResults,
}: ApprovalTabsClientProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [liveReviewCount, setLiveReviewCount] = useState(reviewCount)
    const [activeSampleId, setActiveSampleId] = useState<string | null>(selectedSampleId ?? initialSample?.id ?? null)
    const [activeSample, setActiveSample] = useState<SampleWithUser | null>(initialSample)
    const [activeResults, setActiveResults] = useState<ResultWithAssay[]>(initialResults)
    const [isLoadingSample, setIsLoadingSample] = useState(false)
    const [sampleLoadError, setSampleLoadError] = useState<string | null>(null)
    const tabRef = useRef(tab)
    const sampleRequestIdRef = useRef(0)

    useFaviconBadge(liveReviewCount)

    useEffect(() => {
        tabRef.current = tab
    }, [tab])

    useEffect(() => {
        setLiveReviewCount(reviewCount)
    }, [reviewCount])

    useEffect(() => {
        sampleRequestIdRef.current += 1
        setActiveSampleId(selectedSampleId ?? initialSample?.id ?? null)
        setActiveSample(initialSample)
        setActiveResults(initialResults)
        setSampleLoadError(null)
        setIsLoadingSample(false)
    }, [initialResults, initialSample, selectedSampleId])

    useEffect(() => {
        const supabase = createClient()
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        let isCancelled = false
        let isFetching = false

        const refetchCount = async () => {
            if (isFetching) return
            isFetching = true

            try {
                const response = await fetchSamplesForApprovalCountClient()
                const nextCount = typeof response?.data === 'number' ? response.data : 0
                if (!isCancelled) {
                    setLiveReviewCount(nextCount)
                }
            } catch {
                // ignore; keep last known count
            } finally {
                isFetching = false
            }
        }

        const scheduleUpdate = () => {
            if (timeoutId) return
            timeoutId = setTimeout(async () => {
                timeoutId = null
                await refetchCount()
                if (tabRef.current === 'review') {
                    router.refresh()
                }
            }, 250)
        }

        const channel = supabase
            .channel('manager-approvals-pending-review-count')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'samples' }, () => {
                scheduleUpdate()
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    scheduleUpdate()
                }
            })

        return () => {
            isCancelled = true
            if (timeoutId) clearTimeout(timeoutId)
            void supabase.removeChannel(channel)
        }
    }, [router])

    const buildQueueUrl = useCallback(
        (nextTab: string, nextSampleId: string | null) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', nextTab)

            if (nextSampleId) {
                params.set('sampleId', nextSampleId)
            } else {
                params.delete('sampleId')
            }

            const query = params.toString()
            return query ? `${pathname}?${query}` : pathname
        },
        [pathname, searchParams],
    )

    const handleTabChange = (newTab: string) => {
        router.replace(buildQueueUrl(newTab, activeSampleId))
    }

    const handleSelectSample = useCallback(
        async (nextSampleId: string) => {
            if (nextSampleId === activeSampleId) {
                return
            }

            setActiveSampleId(nextSampleId)
            setActiveSample(null)
            setActiveResults([])
            setSampleLoadError(null)
            setIsLoadingSample(true)
            window.history.replaceState(null, '', buildQueueUrl(tab, nextSampleId))

            const requestId = sampleRequestIdRef.current + 1
            sampleRequestIdRef.current = requestId

            try {
                const [sampleData, resultsResponse] = await Promise.all([
                    fetchSampleDetail(nextSampleId),
                    fetchSampleResultsClient(nextSampleId),
                ])

                if (sampleRequestIdRef.current !== requestId) {
                    return
                }

                setActiveSample(sampleData)
                setActiveResults(resultsResponse?.data ?? [])
            } catch (error) {
                if (sampleRequestIdRef.current !== requestId) {
                    return
                }

                console.error('Failed to load approval sample detail:', error)
                setActiveSample(null)
                setActiveResults([])
                setSampleLoadError('Không thể tải chi tiết mẫu. Vui lòng thử lại.')
            } finally {
                if (sampleRequestIdRef.current === requestId) {
                    setIsLoadingSample(false)
                }
            }
        },
        [activeSampleId, buildQueueUrl, tab],
    )

    const renderQueueContent = () => (
        <div className="flex flex-1 min-h-0 flex-col gap-2">
            <div
                id="tour-approval-queue"
                className="h-[50vh] min-h-[400px] shrink-0 flex flex-col"
            >
                <ApprovalQueueTable
                    data={samples}
                    selectedSampleId={activeSampleId}
                    onSelectSample={handleSelectSample}
                />
            </div>

            <div id="tour-approval-detail" className="flex-1 min-h-0 border-t pt-4">
                <ApprovalBottomRow
                    sample={activeSample}
                    results={activeResults}
                    isLoadingSample={isLoadingSample}
                    loadErrorMessage={sampleLoadError}
                />
            </div>
        </div>
    )

    return (
        <Tabs
            id="tour-approval-tabs"
            value={tab}
            onValueChange={handleTabChange}
            className="flex-1 flex flex-col min-h-0"
        >
            <TabsList className="w-full justify-start border-b border-slate-200 dark:border-slate-800 bg-transparent rounded-none h-auto p-0 mb-4">
                <TabsTrigger
                    value="review"
                    className="relative rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-colors duration-200 data-[state=active]:border-cyan-600 data-[state=active]:text-cyan-700 data-[state=active]:font-semibold data-[state=inactive]:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 data-[state=active]:bg-transparent gap-2"
                >
                    Chờ duyệt KQ
                    {liveReviewCount > 0 && (
                        <Badge className="rounded-full px-2 py-0.5 text-xs bg-red-500 text-white border-0">
                            {liveReviewCount}
                        </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger
                    value="completed"
                    className="relative rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-colors duration-200 data-[state=active]:border-cyan-600 data-[state=active]:text-cyan-700 data-[state=active]:font-semibold data-[state=inactive]:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 data-[state=active]:bg-transparent"
                >
                    Đã duyệt KQ
                </TabsTrigger>
            </TabsList>

            <TabsContent value="review" className="flex-1 min-h-0 mt-0">
                {renderQueueContent()}
            </TabsContent>

            <TabsContent value="completed" className="flex-1 min-h-0 mt-0">
                {renderQueueContent()}
            </TabsContent>
        </Tabs>
    )
}
