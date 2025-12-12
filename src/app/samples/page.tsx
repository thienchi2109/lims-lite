import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard-header'
import { SamplesPageClient } from '@/components/samples-page-client'
import { Suspense } from 'react'
import { getSpecialties } from '@/app/actions/assays'

// This page relies on cookies/session via Supabase, so force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function UnifiedSamplesPage() {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // 2. Get user data and role
    const { data: userData } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .single()

    const role = userData?.role

    // Verify role is valid
    if (!['analyst', 'manager'].includes(role)) {
        redirect('/login')
    }

    // 3. Fetch receiver options (for both analyst and manager roles)
    const { data: receiverData, error: receiverError } = await supabase
        .from('users')
        .select('id, full_name')
        .order('full_name', { ascending: true })

    if (receiverError) {
        console.error('Error fetching receiver list:', receiverError)
    }

    const receiverOptions: Array<{ id: string; name: string }> =
        receiverData?.map((receiver) => ({
            id: String(receiver.id),
            name: receiver.full_name || '',
        })) || []

    const { data: specialties } = await getSpecialties()

    // 4. Build permissions object based on role
    const permissions = {
        canDiscard: role === 'manager',
        canEdit: true, // Both roles can edit (status-gated in component)
        canViewResults: true, // Both roles can view results
        canEnterResults: role === 'analyst', // Only analysts can enter results
    }

    // 5. Determine home dashboard link based on role
    const homeHref = role === 'manager' ? '/manager' : '/analyst'

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
                    role={role as 'analyst' | 'manager'}
                    permissions={permissions}
                    homeHref={homeHref}
                    receiverOptions={receiverOptions}
                    specialties={specialties || []}
                />
            </Suspense>
        </div>
    )
}
