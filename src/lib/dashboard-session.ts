import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { buildAuthenticatedPrincipalKey } from '@/lib/authenticated-query-cache'

export type DashboardUserRole = 'analyst' | 'manager'

export interface AuthenticatedDashboardSession {
    accessToken: string | null
    canAccessConfidential: boolean
    fullName: string | null
    lastSignInAt: string | null
    principalKey: string
    role: DashboardUserRole | null
    userId: string
}

export function isDashboardUserRole(
    role: string | null | undefined,
): role is DashboardUserRole {
    return role === 'analyst' || role === 'manager'
}

export const getAuthenticatedDashboardSession = cache(
    async (): Promise<AuthenticatedDashboardSession | null> => {
        const supabase = await createClient()
        const [
            {
                data: { user },
            },
            {
                data: { session },
            },
        ] = await Promise.all([
            supabase.auth.getUser(),
            supabase.auth.getSession(),
        ])

        if (!user) {
            return null
        }

        const { data: userProfile, error: userProfileError } = await supabase
            .from('users')
            .select('full_name, role, can_access_confidential')
            .eq('id', user.id)
            .single()

        if (userProfileError) {
            console.error(
                'Failed to resolve authenticated dashboard principal',
                userProfileError,
            )
            throw new Error('Không thể xác minh quyền truy cập hiện tại.')
        }

        const role = isDashboardUserRole(userProfile.role)
            ? userProfile.role
            : null
        const canAccessConfidential = userProfile.can_access_confidential === true

        return {
            accessToken: session?.access_token ?? null,
            canAccessConfidential,
            fullName: userProfile.full_name ?? null,
            lastSignInAt: user.last_sign_in_at ?? null,
            principalKey: buildAuthenticatedPrincipalKey({
                userId: user.id,
                role,
                canAccessConfidential,
            }),
            role,
            userId: user.id,
        }
    },
)
