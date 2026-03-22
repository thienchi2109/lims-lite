'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ApprovalQueueTable } from '@/components/approval-queue-table'
import { ApprovalBottomRow } from '@/components/approval-bottom-row'
import type { ApprovalQueueSample, ApprovalTab, ResultWithAssay, SampleWithUser } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { fetchSamplesForApprovalCountClient } from '@/lib/api-client'
import { useFaviconBadge } from '@/hooks/use-favicon-badge'
import { useApprovalSampleCoreCache } from '@/hooks/use-approval-sample-core'
import { useApprovalQueue } from '@/hooks/use-approval-queue'
import { useApprovalUrlState } from '@/hooks/use-approval-url-state'
import { buildApprovalQueueUrl, replaceApprovalQueueUrl } from '@/lib/approval-queue-url'
import { ApprovalQueueErrorState } from '@/components/approval-queue-error-state'
import { ApprovalPageHeader } from '@/components/approval-page-header'

interface ApprovalTabsClientProps {
    tab: 'review' | 'completed'
    samples: ApprovalQueueSample[]
    reviewCount: number
    selectedSampleId?: string
    initialSample: SampleWithUser | null
    initialResults: ResultWithAssay[]
}

interface ApprovalQueueContentProps {
    samples: ApprovalQueueSample[]
    selectedSampleId: string | null
    onSelectSample: (sampleId: string) => void
    sample: SampleWithUser | null
    results: ResultWithAssay[]
    isLoadingSample: boolean
    sampleLoadError: string | null
}

function ApprovalQueueContent({
    samples,
    selectedSampleId,
    onSelectSample,
    sample,
    results,
    isLoadingSample,
    sampleLoadError,
}: ApprovalQueueContentProps) {
    return (
        <div className="flex flex-1 min-h-0 flex-col gap-2">
            <div
                id="tour-approval-queue"
                className="h-[50vh] min-h-[400px] shrink-0 flex flex-col"
            >
                <ApprovalQueueTable
                    data={samples}
                    selectedSampleId={selectedSampleId}
                    onSelectSample={onSelectSample}
                />
            </div>

            <div id="tour-approval-detail" className="flex-1 min-h-0 border-t pt-4">
                <ApprovalBottomRow
                    sample={sample}
                    results={results}
                    isLoadingSample={isLoadingSample}
                    loadErrorMessage={sampleLoadError}
                />
            </div>
        </div>
    )
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
    const [liveReviewCountOverride, setLiveReviewCountOverride] = useState<number | null>(null)
    const liveReviewCount = liveReviewCountOverride ?? reviewCount
    const serverSampleId = selectedSampleId ?? initialSample?.id ?? null
    const { activeTab, setActiveTab, urlSampleId, setUrlSampleId } = useApprovalUrlState({
        tab,
        sampleId: serverSampleId,
    })
    const hasServerSelection = Boolean(urlSampleId && initialSample?.id === urlSampleId)
    const [activeSample, setActiveSample] = useState<SampleWithUser | null>(
        hasServerSelection ? initialSample : null,
    )
    const [activeResults, setActiveResults] = useState<ResultWithAssay[]>(
        hasServerSelection ? initialResults : [],
    )
    const [isLoadingSample, setIsLoadingSample] = useState(false)
    const [sampleLoadError, setSampleLoadError] = useState<string | null>(null)
    const tabRef = useRef<ApprovalTab>(tab)
    const sampleRequestIdRef = useRef(0)
    const isClientSelectionRef = useRef(false)
    const { getCachedSampleCore, loadSampleCore } = useApprovalSampleCoreCache({
        sampleId: serverSampleId,
        initialSample,
        initialResults,
    })
    const approvalQueue = useApprovalQueue({
        tab: activeTab,
        initialData: samples,
        initialDataTab: tab,
    })
    const queueSamples = approvalQueue.data ?? (activeTab === tab ? samples : [])

    useFaviconBadge(liveReviewCount)

    const applyActiveDetail = useCallback(
        (nextDetail: { sample: SampleWithUser; results: ResultWithAssay[] } | null) => {
            setActiveSample(nextDetail?.sample ?? null)
            setActiveResults(nextDetail?.results ?? [])
        },
        [],
    )

    useEffect(() => {
        tabRef.current = activeTab
    }, [activeTab])

    useEffect(() => {
        const serverSelectionMatchesUrl = urlSampleId === serverSampleId
        if (isClientSelectionRef.current && !serverSelectionMatchesUrl) {
            return
        }

        sampleRequestIdRef.current += 1
        applyActiveDetail(
            hasServerSelection && initialSample
                ? { sample: initialSample, results: initialResults }
                : null,
        )
        setSampleLoadError(null)
        setIsLoadingSample(false)
        isClientSelectionRef.current = false
    }, [
        applyActiveDetail,
        hasServerSelection,
        initialResults,
        initialSample,
        serverSampleId,
        urlSampleId,
    ])

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
                    setLiveReviewCountOverride(nextCount)
                }
            } catch {
                // ignore; keep last known count
            }

            isFetching = false
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

    const handleTabChange = useCallback((newTab: string) => {
        const nextTab = newTab as ApprovalTab
        setActiveTab(nextTab)
        setUrlSampleId(null)
        isClientSelectionRef.current = false
        sampleRequestIdRef.current += 1
        applyActiveDetail(null)
        setSampleLoadError(null)
        setIsLoadingSample(false)

        replaceApprovalQueueUrl(
            buildApprovalQueueUrl({
                pathname,
                tab: nextTab,
                sampleId: null,
            }),
        )
    }, [applyActiveDetail, pathname, setActiveTab, setUrlSampleId])

    const handleSelectSample = useCallback(
        async (nextSampleId: string) => {
            if (nextSampleId === urlSampleId && !sampleLoadError) {
                return
            }

            isClientSelectionRef.current = true
            setUrlSampleId(nextSampleId)
            setSampleLoadError(null)
            replaceApprovalQueueUrl(
                buildApprovalQueueUrl({
                    pathname,
                    tab: activeTab,
                    sampleId: nextSampleId,
                }),
            )

            const requestId = sampleRequestIdRef.current + 1
            sampleRequestIdRef.current = requestId
            const cachedSampleCore = getCachedSampleCore(nextSampleId)

            if (cachedSampleCore) {
                applyActiveDetail(cachedSampleCore)
            }

            setIsLoadingSample(!cachedSampleCore)

            const finalizeRequest = () => {
                if (sampleRequestIdRef.current === requestId) {
                    setIsLoadingSample(false)
                }
            }

            try {
                const sampleCore = await loadSampleCore(nextSampleId)

                if (sampleRequestIdRef.current !== requestId) {
                    return
                }

                applyActiveDetail(sampleCore)
                finalizeRequest()
            } catch (error) {
                if (sampleRequestIdRef.current !== requestId) {
                    return
                }

                console.error('Failed to load approval sample detail:', error)
                if (!cachedSampleCore) {
                    applyActiveDetail(null)
                }
                setSampleLoadError('Không thể tải chi tiết mẫu. Vui lòng thử lại.')
                finalizeRequest()
            }
        },
        [
            activeTab,
            applyActiveDetail,
            getCachedSampleCore,
            loadSampleCore,
            pathname,
            sampleLoadError,
            setUrlSampleId,
            urlSampleId,
        ],
    )

    const queueContent = approvalQueue.isError ? (
        <ApprovalQueueErrorState />
    ) : (
        <ApprovalQueueContent
            samples={queueSamples}
            selectedSampleId={urlSampleId}
            onSelectSample={handleSelectSample}
            sample={activeSample}
            results={activeResults}
            isLoadingSample={isLoadingSample}
            sampleLoadError={sampleLoadError}
        />
    )

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-2">
            <ApprovalPageHeader samplesCount={queueSamples.length} tab={activeTab} />

            <Tabs
                id="tour-approval-tabs"
                value={activeTab}
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
                    {queueContent}
                </TabsContent>

                <TabsContent value="completed" className="flex-1 min-h-0 mt-0">
                    {queueContent}
                </TabsContent>
            </Tabs>
        </div>
    )
}
