import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getAssayDefinitions } from '@/app/actions/assays'
import { AssayDefinitionsTable } from '@/components/assay-definitions-table'

export default async function AssaysPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; pageSize?: string; search?: string }>
}) {
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

    if (userData?.role !== 'manager') {
        redirect('/manager')
    }

    // Await searchParams before accessing its properties
    const params = await searchParams

    // Fetch assay definitions
    const page = Number(params?.page) || 1
    const pageSize = Number(params?.pageSize) || 10
    const search = params?.search || ''

    const { data: assays, totalCount, totalPages, error } = await getAssayDefinitions({
        page,
        pageSize,
        search,
    })

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/manager">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Quay lại
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Quản lý chỉ tiêu xét nghiệm
                            </h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Quản lý danh mục chỉ tiêu xét nghiệm/kiểm nghiệm
                            </p>
                        </div>
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
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Danh sách chỉ tiêu xét nghiệm</CardTitle>
                                <CardDescription>
                                    Quản lý các chỉ tiêu xét nghiệm/kiểm nghiệm trong hệ thống
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <div className="text-center py-8 text-red-600">
                                <p>Lỗi: {error}</p>
                            </div>
                        ) : (
                            <AssayDefinitionsTable
                                assays={assays || []}
                                page={page}
                                pageSize={pageSize}
                                totalPages={totalPages || 1}
                                totalCount={totalCount || 0}
                            />
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
