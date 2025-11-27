import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResultsBySample } from '@/app/actions/results'
import { ResultsGrid } from '@/components/results-grid'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
import { SampleStatusBadge } from '@/components/sample-status-badge'

export const metadata: Metadata = {
    title: 'Review Results - CDC LIMS',
    description: 'Review and approve test results',
}

interface PageProps {
    params: Promise<{
        sampleId: string
    }>
}

export default async function ManagerResultsPage({ params }: PageProps) {
    const resolvedParams = await params
    const supabase = await createClient()

    // Get current user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        notFound()
    }

    // Get user role
    const { data: userData } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

    if (!userData || userData.role !== 'manager') {
        notFound()
    }

    // Get sample details
    const { data: sample } = await supabase
        .from('samples')
        .select('*')
        .eq('id', resolvedParams.sampleId)
        .single()

    if (!sample) {
        notFound()
    }

    // Get results for this sample
    const { data: results, error } = await getResultsBySample(resolvedParams.sampleId)

    if (error || !results) {
        return (
            <div className="container mx-auto max-w-7xl p-6">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                    Error loading results: {error}
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href="/manager/samples">
                            <Button variant="ghost" size="sm" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Samples
                            </Button>
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">Review Results</h1>
                        <SampleStatusBadge status={sample.status} />
                    </div>
                    <p className="text-muted-foreground">
                        Manager: {userData.full_name}
                    </p>
                </div>
                <form>
                    <Button variant="outline" size="sm" className="gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                    </Button>
                </form>
            </div>

            {/* Sample Info Card */}
            <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Sample ID
                        </div>
                        <div className="mt-1 font-mono text-lg font-semibold">
                            {sample.sample_id}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Client
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                            {sample.client_name || 'N/A'}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Received At
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                            {new Date(sample.received_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Grid */}
            <ResultsGrid
                results={results}
                sampleId={resolvedParams.sampleId}
                userRole="manager"
            />

            {/* Future: Approval Actions will go here in Phase 4 */}
        </div>
    )
}
