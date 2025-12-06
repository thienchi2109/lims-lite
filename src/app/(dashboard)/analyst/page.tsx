import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Plus, List } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard-header'

export default async function AnalystDashboard() {
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
            <DashboardHeader 
                subtitle="Bảng điều khiển Kiểm nghiệm viên"
                user={userData}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Accession Sample Card */}
                    <Link href="/analyst/accession">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Plus className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>Tiếp nhận mẫu</CardTitle>
                                        <CardDescription>
                                            Tiếp nhận mẫu mới vào hệ thống
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Sử dụng máy quét QR hoặc nhập thủ công để đăng ký mẫu mới
                                </p>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Sample List Card */}
                    <Link href="/analyst/samples">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <List className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>Danh sách mẫu</CardTitle>
                                        <CardDescription>
                                            Xem và quản lý tất cả các mẫu
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Tìm kiếm, lọc và chỉnh sửa thông tin mẫu
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </main>
        </div>
    )
}
