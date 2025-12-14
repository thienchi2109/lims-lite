import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { FlaskConical, CheckCircle2, ClipboardList, User, QrCode } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard-header'
import { getSamplesForApproval } from '@/app/actions/samples'
import { Badge } from '@/components/ui/badge'

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

    const { data: samples } = await getSamplesForApproval()
    const pendingCount = samples?.length || 0

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <DashboardHeader 
                subtitle="Bảng điều khiển Quản lý"
                user={userData}
            />

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
                                        <CardTitle className="flex items-center gap-2">
                                            Hàng đợi phê duyệt
                                            {pendingCount > 0 && (
                                                <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs">
                                                    {pendingCount}
                                                </Badge>
                                            )}
                                        </CardTitle>
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

                    {/* QR Code Portal Card */}
                    <Link href="/manager/qr-code">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-cyan-200 bg-gradient-to-br from-cyan-50/50 to-blue-50/50">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-cyan-600/10 rounded-lg">
                                        <QrCode className="h-6 w-6 text-cyan-600" />
                                    </div>
                                    <div>
                                        <CardTitle>Mã QR Cổng Tra Cứu</CardTitle>
                                        <CardDescription>
                                            Tạo và in mã QR cho khách hàng
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Khách hàng quét mã QR để truy cập và xem kết quả xét nghiệm
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </main>
        </div>
    )

}
