import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getUsers } from '@/app/actions/users'
import { UserListTable } from '@/components/user-list-table'

export default async function UsersPage({
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

    // Fetch users
    const page = Number(params?.page) || 1
    const pageSize = Number(params?.pageSize) || 10
    const search = params?.search || ''
    
    const { data: users, count, totalPages } = await getUsers({
        page,
        pageSize,
        search,
        sortBy: 'created_at',
        sortOrder: 'desc'
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
                                Quản lý người dùng
                            </h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Quản lý tài khoản và phân quyền người dùng
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
                                <CardTitle>Danh sách người dùng</CardTitle>
                                <CardDescription>
                                    Quản lý danh sách nhân viên và quyền truy cập
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <UserListTable
                            users={users || []}
                            page={page}
                            pageSize={pageSize}
                            totalPages={totalPages || 1}
                            totalCount={count || 0}
                        />
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
