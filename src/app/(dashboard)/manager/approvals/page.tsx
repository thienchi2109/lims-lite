import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSamplesForApproval } from '@/app/actions/samples'
import { ApprovalQueueTable } from '@/components/approval-queue-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

export default async function ApprovalsPage() {
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

    // Fetch samples awaiting approval
    const { data: samples, error } = await getSamplesForApproval()

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Mẫu đợi phê duyệt kết quả
                            </h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Xem xét và phê duyệt kết quả xét nghiệm
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {userData?.full_name}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                                {userData?.role}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">
                    {/* Stats Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <CheckCircle2 className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle>Đang chờ phê duyệt</CardTitle>
                                    <CardDescription>
                                        Mẫu có kết quả đang chờ bạn phê duyệt
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-primary">
                                {samples?.length || 0}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {samples?.length === 1 ? 'mẫu' : 'mẫu'} sẵn sàng để xem xét
                            </p>
                        </CardContent>
                    </Card>

                    {/* Approval Queue Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Mẫu đang chờ phê duyệt</CardTitle>
                            <CardDescription>
                                Nhấp vào mẫu để xem xét và phê duyệt kết quả
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {error ? (
                                <div className="text-center py-8 text-destructive">
                                    Lỗi khi tải hàng đợi phê duyệt: {error}
                                </div>
                            ) : (
                                <ApprovalQueueTable data={samples || []} />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
