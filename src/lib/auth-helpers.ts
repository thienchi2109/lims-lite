/**
 * Auth Helpers - Centralized authentication and role verification
 * Reduces boilerplate in server actions from ~12 lines to 2 lines per function
 */

import { createClient } from '@/lib/supabase/server'

export type UserRole = 'analyst' | 'manager' | 'doctor'

export interface AuthenticatedUser {
    id: string
    role: UserRole
}

export interface AuthError {
    error: string
}

/**
 * Type guard to check if result is an auth error
 */
export function isAuthError(result: unknown): result is AuthError {
    return (
        typeof result === 'object' &&
        result !== null &&
        'error' in result &&
        typeof (result as AuthError).error === 'string'
    )
}

/**
 * Validates user session and returns user with role
 * Use when any authenticated user can perform the action
 */
export async function requireAuth(): Promise<AuthenticatedUser | AuthError> {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!userData) {
        return { error: 'User profile not found' }
    }

    return {
        id: user.id,
        role: userData.role as UserRole,
    }
}

/**
 * Validates user session and checks role
 * @param allowedRoles - Single role or array of allowed roles
 */
export async function requireRole(
    allowedRoles: UserRole | UserRole[]
): Promise<AuthenticatedUser | AuthError> {
    const auth = await requireAuth()

    if (isAuthError(auth)) {
        return auth
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

    if (!roles.includes(auth.role)) {
        const roleNames = roles.join(' or ')
        return { error: `Only ${roleNames} can perform this action` }
    }

    return auth
}
