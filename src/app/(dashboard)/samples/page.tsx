import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard-header'
import { SamplesPageClient } from '@/components/samples-page-client'
import { Suspense } from 'react'
import { getSpecialties } from '@/app/actions/assay-lookups'
import {
    getAuthenticatedDashboardSession,
    isDashboardUserRole,
} from '@/lib/dashboard-session'

// This page relies on cookies/session via Supabase, so force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function UnifiedSamplesPage() {
    const dashboardSession = await getAuthenticatedDashboardSession()

    if (!dashboardSession) {
        redirect('/login')
    }

    if (!isDashboardUserRole(dashboardSession.role)) {
        redirect('/login')
    }

    const supabase = await createClient()
    const role = dashboardSession.role
    const isDoctor = role === 'doctor'

    // 2. Fetch receiver options and specialties in parallel
    const [receiverResult, specialtiesResult] = isDoctor
        ? [null, { data: [] }]
        : await Promise.all([
            supabase
                .from('users')
                .select('id, full_name')
                .order('full_name', { ascending: true }),
            getSpecialties(),
        ])

    const receiverData = receiverResult?.data
    if (receiverResult?.error) {
        console.error('Error fetching receiver list:', receiverResult.error)
    }

    const receiverOptions: Array<{ id: string; name: string }> =
        receiverData?.map((receiver) => ({
            id: String(receiver.id),
            name: receiver.full_name || '',
        })) || []

    const specialties = specialtiesResult.data
    const userData = {
        full_name: dashboardSession.fullName,
        role,
    }

    // 4. Build permissions object based on role
    const permissions = {
        canDiscard: role === 'manager',
        canEdit: !isDoctor,
        canViewResults: !isDoctor,
        canEnterResults: role === 'analyst', // Only analysts can enter results
    }

    // 5. Determine home dashboard link based on role
    const homeHref = role === 'manager' ? '/manager' : role === 'analyst' ? '/analyst' : '/samples'

    // 6. Render client component with all required props
    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <DashboardHeader
                subtitle="Quản lý mẫu"
                user={userData}
                className="shrink-0"
            />

            <Suspense fallback={
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-sm text-slate-500">Đang tải...</div>
                </div>
            }>
                <SamplesPageClient
                    role={role}
                    permissions={permissions}
                    homeHref={homeHref}
                    receiverOptions={receiverOptions}
                    specialties={specialties || []}
                />
            </Suspense>
        </div>
    )
}
