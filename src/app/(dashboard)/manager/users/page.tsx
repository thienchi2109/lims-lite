import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getUsers } from '@/app/actions/users'
import { UserListTable } from '@/components/user-list-table'
import { DashboardHeader } from '@/components/dashboard-header'

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
            <DashboardHeader
                subtitle="Quản lý tài khoản và phân quyền người dùng"
                user={userData}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link href="/manager">
                        <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Quay lại
                        </Button>
                    </Link>
                </div>

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
