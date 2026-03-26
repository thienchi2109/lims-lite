import { NextResponse } from 'next/server'
import { getAuthenticatedDashboardSession } from '@/lib/dashboard-session'
import {
    resolveAuthenticatedSessionTimeboxStatus,
    type AuthenticatedSessionTimeboxStatus,
} from '@/lib/session-timebox-status'

type SessionExpiryResponse =
    | AuthenticatedSessionTimeboxStatus
    | { authenticated: false; error: string }

export async function GET() {
    let dashboardSession

    try {
        dashboardSession = await getAuthenticatedDashboardSession()
    } catch (error) {
        console.error(
            'Failed to resolve authenticated principal during session expiry check',
            error,
        )
        return NextResponse.json<SessionExpiryResponse>(
            {
                authenticated: false,
                error: 'Không thể xác minh quyền truy cập hiện tại.',
            },
            { status: 503 },
        )
    }

    if (!dashboardSession) {
        return NextResponse.json<SessionExpiryResponse>(
            { authenticated: false, error: 'Chưa đăng nhập' },
            { status: 401 },
        )
    }

    const response = NextResponse.json<SessionExpiryResponse>(
        await resolveAuthenticatedSessionTimeboxStatus({
            accessToken: dashboardSession.accessToken,
            lastSignInAt: dashboardSession.lastSignInAt,
            principalKey: dashboardSession.principalKey,
        }),
        { status: 200 },
    )
    response.headers.set('Cache-Control', 'no-store')
    return response
}
