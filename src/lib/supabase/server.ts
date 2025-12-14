import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getSupabaseAnonKey, getSupabaseServerUrl, getSupabaseServiceRoleKey } from '@/lib/supabase/env'

export async function createClient() {
    const cookieStore = await cookies()

    const supabaseUrl = getSupabaseServerUrl()

    return createServerClient(
        supabaseUrl,
        getSupabaseAnonKey(),
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

export function createAdminClient() {
    const supabaseUrl = getSupabaseServerUrl()

    return createSupabaseClient(
        supabaseUrl,
        getSupabaseServiceRoleKey(),
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
