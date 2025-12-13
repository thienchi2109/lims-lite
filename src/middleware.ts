import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionTimeboxSeconds } from '@/lib/auth-session-timebox'
import { decodeJwtPayload } from '@/lib/jwt'
import { createEdgeAdminClient } from '@/lib/supabase/edge-admin'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })
    const pendingCookies: Array<{ name: string; value: string; options: any }> = []

    // Prioritize internal Docker URL for middleware (server-side)
    const supabaseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!

    const supabase = createServerClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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

    const isProtectedRoute =
        request.nextUrl.pathname.startsWith('/analyst') ||
        request.nextUrl.pathname.startsWith('/manager')
    const isApiRoute = request.nextUrl.pathname.startsWith('/api')
    const isRootRoute = request.nextUrl.pathname === '/'
    const isLoginRoute = request.nextUrl.pathname === '/login'
    const shouldEnforceTimebox = isProtectedRoute || isApiRoute || isRootRoute || isLoginRoute

    if (shouldEnforceTimebox && user) {
        const {
            data: { session },
        } = await supabase.auth.getSession()

        const accessToken = session?.access_token
        const payload = accessToken
            ? decodeJwtPayload<{ session_id?: string; sid?: string }>(accessToken)
            : null
        const sessionId = payload?.session_id ?? payload?.sid

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
                return response
            }

            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('reason', 'session_expired')

            const response = NextResponse.redirect(url)
            applyCookies(response)
            clearSupabaseAuthCookies(response)
            return response
        }

        if (!sessionId) {
            return signOutAndExpire()
        }

        try {
            const adminClient = createEdgeAdminClient()
            const { data: createdAt, error } = await adminClient.rpc('get_session_created_at', {
                p_session_id: sessionId,
            })

            if (error || !createdAt) {
                return signOutAndExpire()
            }

            const createdAtMs = Date.parse(createdAt)
            if (!Number.isFinite(createdAtMs)) {
                return signOutAndExpire()
            }

            const timeboxSeconds = getSessionTimeboxSeconds()
            const expiresAtMs = createdAtMs + timeboxSeconds * 1000

            if (Date.now() > expiresAtMs) {
                return signOutAndExpire()
            }
        } catch {
            return signOutAndExpire()
        }
    }

    // Get user role from database
    let userRole: string | null = null
    if (user) {
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        userRole = userData?.role || null
    }

    // Protect dashboard routes
    if (isProtectedRoute) {
        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        // Role-based route protection
        if (request.nextUrl.pathname.startsWith('/manager') && userRole !== 'manager') {
            const url = request.nextUrl.clone()
            url.pathname = '/analyst'
            return NextResponse.redirect(url)
        }
    }

    // Redirect logged-in users away from login page
    if (isLoginRoute && user) {
        const url = request.nextUrl.clone()
        url.pathname = userRole === 'manager' ? '/manager' : '/analyst'
        return NextResponse.redirect(url)
    }

    // Redirect root to appropriate dashboard or login
    if (isRootRoute) {
        const url = request.nextUrl.clone()
        if (user) {
            url.pathname = userRole === 'manager' ? '/manager' : '/analyst'
        } else {
            url.pathname = '/login'
        }
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
