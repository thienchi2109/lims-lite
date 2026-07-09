import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionTimeboxSeconds } from '@/lib/auth-session-timebox'
import { decodeJwtPayload } from '@/lib/jwt'
import { shouldRequireManagerStepUp } from '@/lib/manager-email-otp/guards'
import {
    MANAGER_STEP_UP_COOKIE_NAME,
    getManagerStepUpCookieOptions,
} from '@/lib/manager-email-otp/step-up'
import { createEdgeAdminClient } from '@/lib/supabase/edge-admin'
import { SUPABASE_COOKIE_NAME } from '@/lib/supabase/constants'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })
    const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = []

    // Prioritize internal Docker URL for middleware (server-side)
    const supabaseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!

    const supabase = createServerClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookieOptions: {
                name: SUPABASE_COOKIE_NAME,
            },
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    pendingCookies.push(...cookiesToSet)
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh session if expired
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const applyCookies = (response: NextResponse) => {
        pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        return response
    }

    const clearSupabaseAuthCookies = (response: NextResponse) => {
        request.cookies.getAll().forEach(({ name }) => {
            if (!name.startsWith('sb-')) return
            response.cookies.set(name, '', { path: '/', maxAge: 0 })
        })
        return response
    }

    const clearManagerStepUpCookie = (response: NextResponse) => {
        response.cookies.set(MANAGER_STEP_UP_COOKIE_NAME, '', {
            ...getManagerStepUpCookieOptions(),
            maxAge: 0,
        })
        return response
    }

    const isProtectedRoute =
        request.nextUrl.pathname.startsWith('/analyst') ||
        request.nextUrl.pathname.startsWith('/manager') ||
        request.nextUrl.pathname.startsWith('/samples') ||
        request.nextUrl.pathname.startsWith('/profile')
    const isApiRoute = request.nextUrl.pathname.startsWith('/api')
    const isLoginRoute = request.nextUrl.pathname === '/login'
    const shouldEnforceTimebox = isProtectedRoute || isApiRoute || isLoginRoute
    let sessionId: string | null | undefined = null

    if (shouldEnforceTimebox && user) {
        const {
            data: { session },
        } = await supabase.auth.getSession()

        const accessToken = session?.access_token
        const payload = accessToken
            ? decodeJwtPayload<{ session_id?: string; sid?: string }>(accessToken)
            : null
        sessionId = payload?.session_id ?? payload?.sid
        const timeboxSeconds = getSessionTimeboxSeconds()

        const signOutAndExpire = async () => {
            try {
                await supabase.auth.signOut()
            } catch {
                // ignore signOut failures; still clear cookies best-effort
            }

            if (isApiRoute) {
                const response = NextResponse.json(
                    { error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', reason: 'session_expired' },
                    { status: 401 }
                )
                applyCookies(response)
                clearSupabaseAuthCookies(response)
                clearManagerStepUpCookie(response)
                return response
            }

            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('reason', 'session_expired')

            const response = NextResponse.redirect(url)
            applyCookies(response)
            clearSupabaseAuthCookies(response)
            clearManagerStepUpCookie(response)
            return response
        }

        let sessionCreatedAtMs: number | null = null

        if (sessionId) {
            try {
                const adminClient = createEdgeAdminClient()
                const { data: createdAt, error } = await adminClient.rpc('get_session_created_at', {
                    p_session_id: sessionId,
                })

                if (!error && createdAt) {
                    const createdAtMs = Date.parse(createdAt)
                    if (Number.isFinite(createdAtMs)) {
                        sessionCreatedAtMs = createdAtMs
                    }
                } else if (!error && createdAt === null) {
                    // Session was deleted (e.g., by concurrent login invalidation)
                    // Force logout - session no longer exists in database
                    return signOutAndExpire()
                }
            } catch {
                // ignore and fall back to auth.users.last_sign_in_at
            }
        }

        if (sessionCreatedAtMs === null) {
            const lastSignInAt = (user as { last_sign_in_at?: string | null }).last_sign_in_at
            if (lastSignInAt) {
                const lastSignInAtMs = Date.parse(lastSignInAt)
                if (Number.isFinite(lastSignInAtMs)) {
                    sessionCreatedAtMs = lastSignInAtMs
                }
            }
        }

        if (sessionCreatedAtMs !== null) {
            const expiresAtMs = sessionCreatedAtMs + timeboxSeconds * 1000
            if (Date.now() > expiresAtMs) {
                return signOutAndExpire()
            }
        }
    }

    // Get user role from database
    let userRole: string | null = null
    let canAccessConfidential = false
    let otpEmailUpdatedAt: string | null = null
    if (user) {
        const { data: userData } = await supabase
            .from('users')
            .select('role, can_access_confidential, manager_otp_settings(updated_at)')
            .eq('id', user.id)
            .single()

        userRole = userData?.role || null
        canAccessConfidential = userData?.can_access_confidential === true
        const otpSettings = userData?.manager_otp_settings as
            | { updated_at?: string | null }
            | Array<{ updated_at?: string | null }>
            | null
            | undefined
        otpEmailUpdatedAt = Array.isArray(otpSettings)
            ? otpSettings[0]?.updated_at ?? null
            : otpSettings?.updated_at ?? null
    }

    // Protect dashboard routes
    if (isProtectedRoute) {
        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        const redirectByRole = (fallbackPath = '/login') => {
            const url = request.nextUrl.clone()
            url.pathname = userRole === 'manager'
                ? '/manager'
                : userRole === 'analyst'
                    ? '/analyst'
                    : userRole === 'doctor'
                        ? '/samples'
                        : fallbackPath
            return NextResponse.redirect(url)
        }

        // Role-based route protection
        if (
            request.nextUrl.pathname.startsWith('/manager') &&
            request.nextUrl.pathname !== '/manager/otp' &&
            userRole !== 'manager'
        ) {
            return redirectByRole()
        }

        if (
            request.nextUrl.pathname !== '/manager/otp' &&
            await shouldRequireManagerStepUp(
                {
                    userId: user.id,
                    role: userRole,
                    can_access_confidential: canAccessConfidential,
                    sessionId,
                    otpEmailUpdatedAt: otpEmailUpdatedAt ?? 'unconfigured',
                },
                request.cookies,
            )
        ) {
            const url = request.nextUrl.clone()
            url.pathname = '/manager/otp'
            const response = NextResponse.redirect(url)
            applyCookies(response)
            clearManagerStepUpCookie(response)
            return response
        }

        if (request.nextUrl.pathname.startsWith('/analyst') && userRole !== 'analyst') {
            return redirectByRole()
        }

        if (request.nextUrl.pathname.startsWith('/profile') && userRole === 'doctor') {
            return redirectByRole()
        }

        if (request.nextUrl.pathname.startsWith('/samples') && !['analyst', 'manager', 'doctor'].includes(userRole ?? '')) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
    }

    // Redirect logged-in users away from login page
    if (isLoginRoute && user) {
        const url = request.nextUrl.clone()
        url.pathname = userRole === 'manager'
            ? '/manager'
            : userRole === 'doctor'
                ? '/samples'
                : '/analyst'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
