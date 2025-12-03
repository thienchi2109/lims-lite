import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { SampleAccessionForm } from '@/components/sample-accession-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AccessionPage() {
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
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Hệ thống quản lý thông tin khoa Xét nghiệm
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Tiếp nhận mẫu
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
                        <form action={logout}>
                            <Button variant="outline" size="sm" type="submit">
                                Đăng xuất
                            </Button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link href="/analyst">
                        <Button variant="ghost" className="gap-2 pl-0 hover:pl-0 hover:bg-transparent">
                            <ArrowLeft className="h-4 w-4" />
                            Quay lại trang chủ
                        </Button>
                    </Link>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Tiếp nhận mẫu mới
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Nhập thông tin mẫu hoặc quét mã QR để tiếp nhận
                        </p>
                    </div>

                    <SampleAccessionForm />
                </div>
            </main>
        </div>
    )
}
