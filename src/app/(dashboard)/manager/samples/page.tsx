import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SampleListTable } from '@/components/sample-list-table'
import { SampleFilters } from '@/components/sample-filters'
import { SampleBottomRow } from '@/components/sample-bottom-row'
import { fetchSamples } from '@/lib/data/samples'
import { getSample } from '@/app/actions/samples'
import { type SampleStatus } from '@/types'
import { DashboardHeader } from '@/components/dashboard-header'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'

// This page relies on cookies/session via Supabase, so force dynamic rendering
export const dynamic = 'force-dynamic'

type ManagerSamplesPageProps = {
    searchParams?: Promise<{
        search?: string
        status?: string
        page?: string
        pageSize?: string
        fromDate?: string
        toDate?: string
        sortBy?: string
        sortOrder?: string
        receiverId?: string
        sampleId?: string
        view?: string
    }>
}

const validStatuses: SampleStatus[] = ['received', 'assigned', 'in_progress', 'review', 'completed']

export default async function ManagerSamplesPage({ searchParams }: ManagerSamplesPageProps) {
    const params = searchParams ? await searchParams : {}
    const searchTerm = typeof params.search === 'string' ? params.search : ''
    const statusParam = typeof params.status === 'string' ? params.status : 'all'
    const status = validStatuses.includes(statusParam as SampleStatus)
        ? (statusParam as SampleStatus)
        : undefined
    const pageParam = Number(params.page || '1')
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const pageSizeParam = Number(params.pageSize || '20')
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 20
    const fromDate = typeof params.fromDate === 'string' ? params.fromDate : ''
    const toDate = typeof params.toDate === 'string' ? params.toDate : ''
    const sortBy = typeof params.sortBy === 'string' ? params.sortBy : 'created_at'
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc'
    const receiverIdParam = typeof params.receiverId === 'string' ? params.receiverId : ''
    const receiverId = receiverIdParam.match(/^[0-9a-fA-F-]{36}$/) ? receiverIdParam : ''
    const sampleId = typeof params.sampleId === 'string' ? params.sampleId : undefined

    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: userData } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

    // Ensure user is a manager
    if (userData?.role !== 'manager') {
        redirect('/analyst')
    }

    const { data: receiverData, error: receiverError } = await supabase
        .from('users')
        .select('id, full_name')
        .order('full_name', { ascending: true })

    if (receiverError) {
        console.error('Error fetching receiver list:', receiverError)
    }

    const receiverOptions: Array<{ id: string; name: string }> =
        receiverData?.map((receiver) => ({
            id: String(receiver.id),
            name: receiver.full_name || '',
        })) || []

    const result = await fetchSamples({
        page,
        pageSize,
        search: searchTerm || undefined,
        status,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
        receiverId: receiverId || undefined,
    })

    let samplesForDisplay = result.data || []

    // When filtering by in_progress or showing all, highlight samples that have entered (unapproved) results
    if (status === 'in_progress' || status === undefined) {
        const { data: resultSamples } = await supabase
            .from('results')
            .select('sample_id')
            .eq('status', 'entered')

        const needsApprovalIds = new Set((resultSamples || []).map((r: any) => r.sample_id))

        samplesForDisplay = samplesForDisplay.map((sample) => {
            if (
                needsApprovalIds.has(sample.id) &&
                sample.status !== 'review' &&
                sample.status !== 'completed'
            ) {
                return { ...sample, status: 'in_progress' }
            }
            return sample
        })
    }

    // Fetch selected sample if ID is present
    let selectedSample = null
    if (sampleId) {
        const { data: sampleData } = await getSample(sampleId)
        if (sampleData) {
            selectedSample = sampleData
        }
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <DashboardHeader 
                subtitle="Quản lý mẫu"
                user={userData}
                className="shrink-0"
            />

            <main className="flex-1 flex flex-col min-h-0 p-2 sm:px-4 gap-2">
                <div className="flex items-center gap-4 shrink-0">
                    <Link href="/manager">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Quay lại Bảng điều khiển
                        </Button>
                    </Link>
                </div>

                {/* Top Row: Filters & Grid (Fixed Height ~50%) */}
                <div className="flex flex-col gap-2 h-[50vh] min-h-[400px] shrink-0">
                    <div className="shrink-0">
                        <Suspense fallback={<div className="text-sm text-slate-500">Đang tải bộ lọc...</div>}>
                            <SampleFilters
                                search={searchTerm}
                                status={(status ?? 'all')}
                                fromDate={fromDate}
                                toDate={toDate}
                                pageSize={Number(pageSize)}
                                sortBy={sortBy}
                                sortOrder={sortOrder as 'asc' | 'desc'}
                                receiverId={receiverId}
                                receiverOptions={receiverOptions}
                            />
                        </Suspense>
                    </div>
                    <div className="flex-1 min-h-0">
                        <Suspense fallback={<div className="text-sm text-slate-500">Đang tải danh sách mẫu...</div>}>
                            <SampleListTable
                                samples={samplesForDisplay || []}
                                page={result.page || page}
                                pageSize={result.pageSize || pageSize}
                                totalPages={result.totalPages || 1}
                                totalCount={result.count || 0}
                                error={result.error || null}
                                isManager={true}
                                sortBy={sortBy}
                                sortOrder={sortOrder as 'asc' | 'desc'}
                                selectedSampleId={selectedSample?.id}
                            />
                        </Suspense>
                    </div>
                </div>

                {/* Bottom Row: Detail & Assignments (Remaining Height) */}
                <div className="flex-1 min-h-0 border-t pt-4">
                    <SampleBottomRow sample={selectedSample} />
                </div>
            </main>
        </div>
    )
}
