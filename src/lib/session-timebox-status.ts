import { createAdminClient } from '@/lib/supabase/server'
import { decodeJwtPayload } from '@/lib/jwt'
import { getSessionTimeboxSeconds } from '@/lib/auth-session-timebox'

export type SessionExpirySource =
    | 'sessions.created_at'
    | 'auth.users.last_sign_in_at'
    | 'unknown'

export interface AuthenticatedSessionTimeboxStatus {
    authenticated: true
    timebox_seconds: number
    expires_at: string | null
    expires_in_ms: number | null
    source: SessionExpirySource
    principal_key: string
}

interface ResolveAuthenticatedSessionTimeboxStatusOptions {
    accessToken: string | null
    lastSignInAt: string | null
    principalKey: string
}

export async function resolveAuthenticatedSessionTimeboxStatus({
    accessToken,
    lastSignInAt,
    principalKey,
}: ResolveAuthenticatedSessionTimeboxStatusOptions): Promise<AuthenticatedSessionTimeboxStatus> {
    const payload = accessToken
        ? decodeJwtPayload<{ session_id?: string; sid?: string }>(accessToken)
        : null
    const sessionId = payload?.session_id ?? payload?.sid

    let sessionCreatedAtMs: number | null = null
    let source: SessionExpirySource = 'unknown'

    if (sessionId) {
        try {
            const adminClient = createAdminClient()
            const { data: createdAt, error } = await adminClient.rpc(
                'get_session_created_at',
                {
                    p_session_id: sessionId,
                },
            )

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

    if (sessionCreatedAtMs === null && lastSignInAt) {
        const lastSignInAtMs = Date.parse(lastSignInAt)
        if (Number.isFinite(lastSignInAtMs)) {
            sessionCreatedAtMs = lastSignInAtMs
            source = 'auth.users.last_sign_in_at'
        }
    }

    const timeboxSeconds = getSessionTimeboxSeconds()
    const nowMs = Date.now()
    const expiresAtMs =
        sessionCreatedAtMs !== null
            ? sessionCreatedAtMs + timeboxSeconds * 1000
            : null

    return {
        authenticated: true,
        timebox_seconds: timeboxSeconds,
        expires_at:
            expiresAtMs !== null ? new Date(expiresAtMs).toISOString() : null,
        expires_in_ms:
            expiresAtMs !== null ? Math.max(0, expiresAtMs - nowMs) : null,
        source,
        principal_key: principalKey,
    }
}
