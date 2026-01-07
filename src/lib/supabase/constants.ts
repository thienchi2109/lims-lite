/**
 * Supabase Authentication Constants
 *
 * IMPORTANT: Cookie name must be consistent across ALL Supabase clients:
 * - src/lib/supabase/client.ts (browser)
 * - src/lib/supabase/server.ts (server)
 * - src/middleware.ts (middleware)
 *
 * Without explicit cookie name, Supabase SSR derives it from the URL hostname,
 * causing mismatches between environments (localhost vs Docker vs production).
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

/**
 * Consistent cookie name for Supabase authentication.
 * Used by browser client, server client, and middleware.
 *
 * Format follows Supabase convention: sb-{identifier}-auth-token
 */
export const SUPABASE_COOKIE_NAME = 'sb-lims-auth-token'
