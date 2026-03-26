'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSessionTimeboxExpiryClient, logoutClient } from '@/lib/api-client'
import { clearAuthenticatedQueryCache } from '@/lib/authenticated-query-cache'
import { createClient } from '@/lib/supabase/client'

const CHANNEL_NAME = 'auth-session-timebox'

type LogoutReason = 'session_expired' | 'signed_out_elsewhere'
type LogoutBroadcastMessage = {
    type: 'logout'
    reason?: LogoutReason
}

export function SessionTimeboxGuard() {
    const hasTriggeredRef = useRef(false)
    const queryClient = useQueryClient()

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        let intervalId: ReturnType<typeof setInterval> | null = null
        const abortController = new AbortController()

        const broadcastChannel =
            typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null

        const cleanupTimers = () => {
            if (timeoutId) clearTimeout(timeoutId)
            if (intervalId) clearInterval(intervalId)
            timeoutId = null
            intervalId = null
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

        const scheduleFromServer = async () => {
            cleanupTimers()

            const status = await getSessionTimeboxExpiryClient({ signal: abortController.signal })

            if (!status.authenticated) {
                if (status.reason === 'session_expired') {
                    await triggerLogout('session_expired')
                    return
                }

                clearAuthenticatedQueryCache(queryClient)
                redirectToLogin('signed_out_elsewhere')
                return
            }

            if (status.expires_in_ms === null) {
                intervalId = setInterval(() => {
                    scheduleFromServer().catch(() => {
                        // ignore; next interval will retry
                    })
                }, 60_000)
                return
            }

            if (status.expires_in_ms <= 0) {
                await triggerLogout('session_expired')
                return
            }

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
            const data = event.data as LogoutBroadcastMessage | null
            if (!data || data.type !== 'logout') return
            triggerLogout(data.reason === 'session_expired' ? 'session_expired' : 'signed_out_elsewhere').catch(() => {
                // ignore
            })
        }

        broadcastChannel?.addEventListener('message', handleBroadcastMessage)
        window.addEventListener('focus', handleVisibilityOrFocus)
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)

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
    }, [queryClient])

    return null
}
