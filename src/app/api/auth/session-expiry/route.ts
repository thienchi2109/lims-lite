import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { decodeJwtPayload } from '@/lib/jwt'
import { getSessionTimeboxSeconds } from '@/lib/auth-session-timebox'

type SessionExpirySource = 'sessions.created_at' | 'auth.users.last_sign_in_at' | 'unknown'

type SessionExpiryResponse =
    | {
          authenticated: true
          timebox_seconds: number
          expires_at: string | null
          expires_in_ms: number | null
          source: SessionExpirySource
      }
    | { authenticated: false; error: string }

export async function GET() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json<SessionExpiryResponse>(
            { authenticated: false, error: 'Chưa đăng nhập' },
            { status: 401 }
        )
    }

    const {
        data: { session },
    } = await supabase.auth.getSession()

    const timeboxSeconds = getSessionTimeboxSeconds()
    const accessToken = session?.access_token
    const payload = accessToken ? decodeJwtPayload<{ session_id?: string; sid?: string }>(accessToken) : null
    const sessionId = payload?.session_id ?? payload?.sid

    let sessionCreatedAtMs: number | null = null
    let source: SessionExpirySource = 'unknown'

    if (sessionId) {
        try {
            const adminClient = createAdminClient()
            const { data: createdAt, error } = await adminClient.rpc('get_session_created_at', {
                p_session_id: sessionId,
            })

            if (!error && createdAt) {
                const createdAtMs = Date.parse(createdAt)
                if (Number.isFinite(createdAtMs)) {
                    sessionCreatedAtMs = createdAtMs
                    source = 'sessions.created_at'
                }
            }
        } catch {
            // ignore and fall back
        }
    }

    if (sessionCreatedAtMs === null) {
        const lastSignInAt = (user as any).last_sign_in_at as string | null | undefined
        if (lastSignInAt) {
            const lastSignInAtMs = Date.parse(lastSignInAt)
            if (Number.isFinite(lastSignInAtMs)) {
                sessionCreatedAtMs = lastSignInAtMs
                source = 'auth.users.last_sign_in_at'
            }
        }
    }

    const nowMs = Date.now()
    const expiresAtMs = sessionCreatedAtMs !== null ? sessionCreatedAtMs + timeboxSeconds * 1000 : null
    const expiresInMs =
        expiresAtMs !== null ? Math.max(0, expiresAtMs - nowMs) : null

    const response = NextResponse.json<SessionExpiryResponse>(
        {
            authenticated: true,
            timebox_seconds: timeboxSeconds,
            expires_at: expiresAtMs !== null ? new Date(expiresAtMs).toISOString() : null,
            expires_in_ms: expiresInMs,
            source,
        },
        { status: 200 }
    )
    response.headers.set('Cache-Control', 'no-store')
    return response
}
