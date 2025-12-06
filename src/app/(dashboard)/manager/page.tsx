import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { FlaskConical, CheckCircle2, ClipboardList, User } from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'

export default async function ManagerDashboard() {
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Hệ thống quản lý thông tin khoa Xét nghiệm
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Bảng điều khiển Quản lý
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
                        <LogoutButton />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Sample Management Card */}
                    <Link href="/manager/samples">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <FlaskConical className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>Quản lý mẫu</CardTitle>
                                        <CardDescription>
                                            Quản lý mẫu và chỉ định xét nghiệm
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Xem tất cả mẫu, chỉ định xét nghiệm và quản lý quy trình
                                </p>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Approval Queue Card */}
                    <Link href="/manager/approvals">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-600/10 rounded-lg">
                                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <CardTitle>Hàng đợi phê duyệt</CardTitle>
                                        <CardDescription>
                                            Xem xét và phê duyệt kết quả xét nghiệm
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Phê duyệt kết quả đã nhập và quản lý phê duyệt
                                </p>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Assay Definitions Card */}
                    <Link href="/manager/assays">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-600/10 rounded-lg">
                                        <ClipboardList className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <CardTitle>Chỉ tiêu xét nghiệm</CardTitle>
                                        <CardDescription>
                                            Quản lý danh mục chỉ tiêu
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Thêm, sửa, xóa chỉ tiêu xét nghiệm trong hệ thống
                                </p>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* User Management Card */}
                    <Link href="/manager/users">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-600/10 rounded-lg">
                                        <User className="h-6 w-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <CardTitle>Quản lý người dùng</CardTitle>
                                        <CardDescription>
                                            Quản lý tài khoản và phân quyền
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Thêm, sửa, xóa người dùng và quản lý vai trò trong hệ thống
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </main>
        </div>
    )
}
