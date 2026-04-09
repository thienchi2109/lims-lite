import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// This page relies on cookies/session via Supabase, so force dynamic rendering
export const dynamic = 'force-dynamic'

function buildQueryString(params: Record<string, string | string[] | undefined>) {
    const pairs = Object.entries(params).flatMap(([key, value]) => {
        if (Array.isArray(value)) return value.map((item): [string, string] => [key, item])
        return value === undefined ? [] : [[key, value] satisfies [string, string]]
    })

    return new URLSearchParams(pairs).toString()
}

/**
 * Legacy route for manager samples page.
 * Redirects to unified /samples page while preserving query parameters.
 */
export default async function ManagerSamplesRedirect({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // 2. Verify manager role
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'manager') {
        redirect('/login')
    }

    // 3. Preserve query parameters and redirect to unified page
    const params = await searchParams
    const queryString = buildQueryString(params)

    redirect(`/samples${queryString ? `?${queryString}` : ''}`)
}
