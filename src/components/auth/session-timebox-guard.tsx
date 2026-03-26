'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSessionTimeboxExpiryClient, logoutClient } from '@/lib/api-client'
import { clearAuthenticatedQueryCache } from '@/lib/authenticated-query-cache'
import { createClient } from '@/lib/supabase/client'

const CHANNEL_NAME = 'auth-session-timebox'
const STATUS_REFRESH_INTERVAL_MS = 60_000

type LogoutReason = 'session_expired' | 'signed_out_elsewhere'
type AuthGuardBroadcastMessage =
    | {
          type: 'logout'
          reason?: LogoutReason
      }
    | {
          type: 'principal_changed'
          principalKey: string
      }

interface SessionTimeboxGuardProps {
    principalKey: string
}

export function SessionTimeboxGuard({ principalKey }: SessionTimeboxGuardProps) {
    const hasTriggeredRef = useRef(false)
    const queryClient = useQueryClient()

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        let refreshIntervalId: ReturnType<typeof setInterval> | null = null
        const abortController = new AbortController()

        const broadcastChannel =
            typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null

        const clearExpiryTimeout = () => {
            if (timeoutId) clearTimeout(timeoutId)
            timeoutId = null
        }

        const cleanupTimers = () => {
            clearExpiryTimeout()
            if (refreshIntervalId) clearInterval(refreshIntervalId)
            refreshIntervalId = null
        }

        const redirectToLogin = (reason: LogoutReason) => {
            if (reason !== 'session_expired') {
                window.location.href = '/login'
                return
            }

            const url = new URL('/login', window.location.origin)
            url.searchParams.set('reason', 'session_expired')
            window.location.href = url.toString()
        }

        const triggerLogout = async (reason: LogoutReason) => {
            if (hasTriggeredRef.current) return
            hasTriggeredRef.current = true
            clearAuthenticatedQueryCache(queryClient)

            try {
                broadcastChannel?.postMessage({ type: 'logout', reason })
            } catch {
                // ignore broadcast failures
            }

            try {
                await logoutClient()
            } catch {
                // ignore; still redirect
            }

            try {
                const supabase = createClient()
                await supabase.auth.signOut()
            } catch {
                // ignore; still redirect
            }

            redirectToLogin(reason)
        }

        const refreshForPrincipalChange = (nextPrincipalKey: string) => {
            if (hasTriggeredRef.current) return
            if (nextPrincipalKey === principalKey) return

            hasTriggeredRef.current = true
            clearAuthenticatedQueryCache(queryClient)

            try {
                broadcastChannel?.postMessage({ type: 'principal_changed', principalKey: nextPrincipalKey })
            } catch {
                // ignore broadcast failures
            }

            window.location.reload()
        }

        const scheduleFromServer = async () => {
            const status = await getSessionTimeboxExpiryClient({ signal: abortController.signal })

            if (!status.authenticated) {
                clearExpiryTimeout()
                if (status.reason === 'session_expired') {
                    await triggerLogout('session_expired')
                    return
                }

                clearAuthenticatedQueryCache(queryClient)
                redirectToLogin('signed_out_elsewhere')
                return
            }

            if (status.principal_key !== principalKey) {
                clearExpiryTimeout()
                refreshForPrincipalChange(status.principal_key)
                return
            }

            if (status.expires_in_ms === null) {
                clearExpiryTimeout()
                return
            }

            if (status.expires_in_ms <= 0) {
                clearExpiryTimeout()
                await triggerLogout('session_expired')
                return
            }

            clearExpiryTimeout()
            timeoutId = setTimeout(() => {
                triggerLogout('session_expired').catch(() => {
                    // ignore
                })
            }, status.expires_in_ms)
        }

        const handleVisibilityOrFocus = () => {
            if (hasTriggeredRef.current) return
            if (document.visibilityState !== 'visible') return
            scheduleFromServer().catch(() => {
                // ignore
            })
        }

        const handleBroadcastMessage = (event: MessageEvent) => {
            const data = event.data as AuthGuardBroadcastMessage | null
            if (!data) return

            if (data.type === 'logout') {
                triggerLogout(data.reason === 'session_expired' ? 'session_expired' : 'signed_out_elsewhere').catch(() => {
                    // ignore
                })
                return
            }

            if (data.type === 'principal_changed') {
                refreshForPrincipalChange(data.principalKey)
            }
        }

        broadcastChannel?.addEventListener('message', handleBroadcastMessage)
        window.addEventListener('focus', handleVisibilityOrFocus)
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)
        refreshIntervalId = setInterval(() => {
            if (hasTriggeredRef.current) return
            scheduleFromServer().catch(() => {
                // ignore; next interval will retry
            })
        }, STATUS_REFRESH_INTERVAL_MS)

        scheduleFromServer().catch(() => {
            // ignore; we will retry on focus/visibility
        })

        return () => {
            abortController.abort()
            cleanupTimers()
            broadcastChannel?.removeEventListener('message', handleBroadcastMessage)
            broadcastChannel?.close()
            window.removeEventListener('focus', handleVisibilityOrFocus)
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
        }
    }, [principalKey, queryClient])

    return null
}
