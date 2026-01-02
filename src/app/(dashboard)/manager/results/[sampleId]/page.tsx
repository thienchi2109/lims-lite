import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResultsBySample } from '@/app/actions/results'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { ApprovalActions } from '@/components/approval-actions'
import { CoAActions } from '@/components/coa-actions'
import { CoAAccessLogViewer } from '@/components/coa-access-log-viewer'
import { SampleActivityFeed } from '@/components/sample-activity-feed'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { CoAStatusBadge } from '@/components/coa-status-badge'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Xem xét kết quả - CDC LIMS',
    description: 'Xem xét và phê duyệt kết quả xét nghiệm',
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
        return (
            <div className="p-6 text-red-500">
                Error: User not authenticated. Please log in.
            </div>
        )
    }

    // Get user role
    const { data: userData } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

    if (!userData || userData.role !== 'manager') {
        return (
            <div className="p-6 text-red-500">
                Error: Unauthorized. User role is '{userData?.role}', expected 'manager'.
            </div>
        )
    }

    // Get sample details
    const { data: sample } = await supabase
        .from('samples')
        .select('*')
        .eq('id', resolvedParams.sampleId)
        .single()

    if (!sample) {
        return (
            <div className="p-6 text-red-500">
                Error: Sample not found in database.
                <br />
                Requested ID: {resolvedParams.sampleId}
                <br />
                User ID: {user.id}
            </div>
        )
    }

    // Get CoA report for this sample (if exists)
    const { data: coaReport } = await supabase
        .from('coa_reports')
        .select('id, status, error_message, file_path, generated_at')
        .eq('sample_id', resolvedParams.sampleId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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
                        <Link href="/manager/samples">
                            <Button variant="ghost" size="sm" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Quay lại danh sách mẫu
                            </Button>
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">Xem xét kết quả</h1>
                        <div className="flex items-center gap-2">
                            <SampleStatusBadge status={sample.status} />
                            {sample.status === 'completed' && (
                                <CoAStatusBadge status={coaReport?.status} />
                            )}
                        </div>
                    </div>
                    <p className="text-muted-foreground">
                        Quản lý: {userData.full_name}
                    </p>
                </div>
                <form>
                    <Button variant="outline" size="sm" className="gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        Làm mới
                    </Button>
                </form>
            </div>

            {/* Sample Info Card */}
            <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Mã mẫu
                        </div>
                        <div className="mt-1 font-mono text-lg font-semibold">
                            {sample.sample_id}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Khách hàng
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                            {sample.client_name || 'N/A'}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Đã nhận lúc
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                            {new Date(sample.received_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Grid */}
            <AssignedTestsPanel sampleId={resolvedParams.sampleId} userRole="manager" />

            {/* Approval Actions */}
            <ApprovalActions sampleId={resolvedParams.sampleId} results={results} />

            {/* CoA Actions */}
            <CoAActions
                sampleId={resolvedParams.sampleId}
                sampleStatus={sample.status}
                coaReport={coaReport || null}
            />

            {/* CoA Access Log Viewer - Only show for completed samples with CoA */}
            {sample.status === 'completed' && coaReport?.status === 'ready' && (
                <CoAAccessLogViewer sampleId={resolvedParams.sampleId} />
            )}

            {/* Activity Feed */}
            <Collapsible defaultOpen={false}>
                <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                        <span className="font-semibold">Lịch sử hoạt động</span>
                        <ChevronDown className="h-4 w-4 transition-transform ui-open:rotate-180" />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                    <SampleActivityFeed sampleId={resolvedParams.sampleId} />
                </CollapsibleContent>
            </Collapsible>
        </div>
    )
}
