import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSamplesForApproval, getSample } from '@/app/actions/samples'
import { getResultsBySample } from '@/app/actions/results'
import { ApprovalQueueTable } from '@/components/approval-queue-table'
import { ApprovalBottomRow } from '@/components/approval-bottom-row'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ResultWithAssay } from '@/types'

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

    // Fetch samples awaiting approval
    const { data: samples, error } = await getSamplesForApproval()

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
            <header className="shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 sm:px-6 lg:px-8 py-4 transition-all duration-200">
                <div className="flex items-center justify-between max-w-[1920px] mx-auto">
                    <div className="flex items-center gap-4">
                        <Link href="/manager">
                            <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Quay lại
                            </Button>
                        </Link>
                        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800" />
                        <div>
                            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                                Phê duyệt kết quả
                            </h1>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {samples?.length || 0} mẫu đang chờ phê duyệt
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-6">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {userData?.full_name}
                            </p>
                            <div className="flex items-center justify-end gap-1.5">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize font-medium">
                                    {userData?.role}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col min-h-0 p-4 sm:px-6 lg:px-8 gap-4">
                {/* Top Row: Queue (Fixed Height ~50%) */}
                <div className="h-[50vh] min-h-[400px] shrink-0">
                    {error ? (
                        <div className="text-center py-8 text-destructive bg-white dark:bg-slate-900 rounded-lg border">
                            Lỗi khi tải hàng đợi phê duyệt: {error}
                        </div>
                    ) : (
                        <ApprovalQueueTable
                            data={samples || []}
                            selectedSampleId={selectedSample?.id}
                        />
                    )}
                </div>

                {/* Bottom Row: Detail & Actions (Remaining Height) */}
                <div className="flex-1 min-h-0 border-t pt-4">
                    <ApprovalBottomRow
                        sample={selectedSample}
                        results={results}
                    />
                </div>
            </main>
        </div>
    )
}
