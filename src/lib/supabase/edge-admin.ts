import { createClient } from '@supabase/supabase-js'

export function createEdgeAdminClient() {
    const supabaseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!

    return createClient(
        supabaseUrl,
        process.env.SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

