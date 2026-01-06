import { createBrowserClient } from '@supabase/ssr'

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
            // Server uses SUPABASE_INTERNAL_URL (http://kong:8000) which creates 'sb-kong-auth-token'
            // Browser must use the same cookie name to read the session
            cookieOptions: {
                name: 'sb-kong-auth-token',
            },
        }
    )
}
