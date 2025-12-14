import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from '@/lib/supabase/env'

export function createEdgeAdminClient() {
    const supabaseUrl = getSupabaseServerUrl()

    return createClient(
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
