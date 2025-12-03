import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { SampleListTable } from '@/components/sample-list-table'
import { SampleFilters } from '@/components/sample-filters'
import { fetchSamples } from '@/lib/data/samples'
import { type SampleStatus } from '@/types'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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

    const result = await fetchSamples({
        page,
        pageSize,
        search: searchTerm || undefined,
        status,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Hệ thống quản lý thông tin khoa Xét nghiệm
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Quản lý mẫu
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {userData?.full_name}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                                {userData?.role}
                            </p>
                        </div>
                        <form action={logout}>
                            <Button variant="outline" size="sm" type="submit">
                                Đăng xuất
                            </Button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link href="/manager">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Quay lại Bảng điều khiển
                        </Button>
                    </Link>
                </div>

                <div className="mb-6">
                    <SampleFilters
                        search={searchTerm}
                        status={(status ?? 'all')}
                        fromDate={fromDate}
                        toDate={toDate}
                        pageSize={Number(pageSize)}
                        sortBy={sortBy}
                        sortOrder={sortOrder as 'asc' | 'desc'}
                    />
                </div>

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
                />
            </main>
        </div>
    )
}
