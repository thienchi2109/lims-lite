import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResultsBySample } from '@/app/actions/results'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
import { SampleStatusBadge } from '@/components/sample-status-badge'

export const metadata: Metadata = {
    title: 'Nhập kết quả - CDC LIMS',
    description: 'Nhập liệu cho kết quả xét nghiệm',
}

interface PageProps {
    params: Promise<{
        sampleId: string
    }>
}

export default async function AnalystResultsPage({ params }: PageProps) {
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

    if (!userData || userData.role !== 'analyst') {
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
                    Lỗi khi tải kết quả: {error}
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
                        <Link href="/analyst/samples">
                            <Button variant="ghost" size="sm" className="gap-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <ArrowLeft className="h-4 w-4" />
                                Quay lại danh sách mẫu
                            </Button>
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                            Nhập kết quả
                        </h1>
                        <SampleStatusBadge status={sample.status} />
                    </div>
                    <p className="text-muted-foreground font-medium">
                        Kiểm nghiệm viên: <span className="text-foreground">{userData.full_name}</span>
                    </p>
                </div>
                <Button variant="outline" size="icon" asChild className="hover:bg-slate-100 dark:hover:bg-slate-800">
                    <a href={`/analyst/results/${resolvedParams.sampleId}`}>
                        <RefreshCcw className="h-4 w-4" />
                        <span className="sr-only">Làm mới</span>
                    </a>
                </Button>
            </div>

            <AssignedTestsPanel sampleId={resolvedParams.sampleId} userRole="analyst" />
        </div>
    )
}
