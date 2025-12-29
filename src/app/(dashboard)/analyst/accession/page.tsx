import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SampleAccessionForm } from '@/components/sample-accession-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard-header'
import { getSpecialties } from '@/app/actions/assay-lookups'
import { AccessionPageHeader } from './accession-page-header'

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

    const { data: specialties } = await getSpecialties()

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <DashboardHeader
                subtitle="Tiếp nhận mẫu"
                user={userData}
            />

            <main className="w-full px-4 sm:px-6 lg:px-8 py-2">
                <div className="mb-2">
                    <Link href="/analyst">
                        <Button variant="ghost" className="gap-2 pl-0 hover:pl-0 hover:bg-transparent">
                            <ArrowLeft className="h-4 w-4" />
                            Quay lại trang chủ
                        </Button>
                    </Link>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-3">
                    <AccessionPageHeader />

                    <SampleAccessionForm specialties={specialties || []} />
                </div>
            </main>
        </div>
    )
}
