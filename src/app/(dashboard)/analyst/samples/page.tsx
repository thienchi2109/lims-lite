import { Suspense } from 'react'
import { getSamples, getSample } from '@/app/actions/samples'
import { SampleListTable } from '@/components/sample-list-table'
import { SampleFilters } from '@/components/sample-filters'
import { SampleBottomRow } from '@/components/sample-bottom-row'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { SampleListParamsSchema } from '@/types'

interface SamplesPageProps {
    searchParams: { [key: string]: string | string[] | undefined }
}

export default async function SamplesPage({ searchParams }: SamplesPageProps) {
    // Parse search params
    const page = Number(searchParams.page) || 1
    const pageSize = Number(searchParams.pageSize) || 10
    const status = searchParams.status as string | undefined
    const search = searchParams.search as string | undefined
    const sortBy = (searchParams.sortBy as string) || 'created_at'
    const sortOrder = (searchParams.sortOrder as 'asc' | 'desc') || 'desc'
    const sampleId = searchParams.sampleId as string | undefined

    // Validate params
    const validatedParams = SampleListParamsSchema.safeParse({
        page,
        pageSize,
        status,
        search,
        sortBy,
        sortOrder,
    })

    if (!validatedParams.success) {
        return <div>Invalid parameters</div>
    }

    // Fetch samples list
    const result = await getSamples(validatedParams.data)

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
            <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/analyst">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Quay lại
                            </Button>
                        </Link>
                        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            Quản lý mẫu
                        </h1>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col min-h-0 p-4 sm:px-6 lg:px-8 gap-4">
                {/* Top Row: Filters & Grid (Fixed Height ~50%) */}
                <div className="flex flex-col gap-4 h-[50vh] min-h-[400px] shrink-0">
                    <div className="shrink-0">
                        <SampleFilters
                            search={search}
                            status={status as any} // Cast to any or specific type if needed, strict check might fail if status is undefined
                            pageSize={pageSize}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                        />
                    </div>
                    <div className="flex-1 min-h-0">
                        <SampleListTable
                            samples={result.data || []}
                            page={page}
                            pageSize={pageSize}
                            totalPages={result.totalPages || 0}
                            totalCount={result.count || 0}
                            error={result.error}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            selectedSampleId={selectedSample?.id}
                        />
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
