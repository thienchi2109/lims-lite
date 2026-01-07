import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_COOKIE_NAME } from '@/lib/supabase/constants'

export function createClient() {
    // Fallback to current origin (browser) if env var is not set
    // This allows the app to work behind a tunnel with a dynamic URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '')

    return createBrowserClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            // Use consistent cookie name between server and browser
            cookieOptions: {
                name: SUPABASE_COOKIE_NAME,
            },
        }
    )
}
