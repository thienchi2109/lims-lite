'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { managerRequiresOtp } from '@/lib/manager-email-otp/guards'
import { LoginSchema } from '@/types'
import { redirect } from 'next/navigation'

export async function login(_prevState: unknown, formData: FormData) {
    const supabase = await createClient()

    // Validate input
    const rawData = {
        username: formData.get('username'),
        password: formData.get('password'),
    }

    const validation = LoginSchema.safeParse(rawData)

    if (!validation.success) {
        return {
            error: validation.error.flatten().fieldErrors,
        }
    }

    const usernameInput = validation.data.username.trim()
    const { password } = validation.data

    // Allow logging in with email OR username.
    // If user enters a username, resolve it to the user's email in `public.users`
    // (falling back to the seeded `@cdc-lims.local` convention).
    const emailSuffix = '@cdc-lims.local'
    let email = usernameInput

    if (!usernameInput.includes('@')) {
        try {
            const adminClient = createAdminClient()
            const { data: resolvedEmail, error: lookupError } = await adminClient.rpc(
                'get_user_email_by_username',
                { p_username: usernameInput }
            )

            if (!lookupError && typeof resolvedEmail === 'string' && resolvedEmail) {
                email = resolvedEmail
            } else {
                email = `${usernameInput}${emailSuffix}`
            }
        } catch {
            email = `${usernameInput}${emailSuffix}`
        }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return {
            error: { general: ['Invalid username or password'] },
        }
    }

    // Prevent concurrent sessions: invalidate all OTHER sessions for this user
    // SECURITY: This runs AFTER successful authentication to prevent DoS
    try {
        const adminClient = createAdminClient()

        if (data.user.id) {
            // Get the most recent session ID (the one just created by signInWithPassword)
            const { data: sessionId, error: sessionError } = await adminClient.rpc(
                'get_latest_session_id',
                { p_user_id: data.user.id }
            )

            if (!sessionError && sessionId) {
                // Invalidate all OTHER sessions, keeping the current one
                await adminClient.rpc('invalidate_other_user_sessions', {
                    p_user_id: data.user.id,
                    p_keep_session_id: sessionId
                })
            }
        }
    } catch (error) {
        // Log error but don't block login
        // If session invalidation fails, login still succeeds
        console.error('Failed to invalidate other sessions:', error)
    }

    // Get user role
    const { data: userData } = await supabase
        .from('users')
        .select('role, can_access_confidential')
        .eq('id', data.user.id)
        .single()

    const role = userData?.role || 'analyst'

    if (
        role === 'manager' &&
        managerRequiresOtp({
            role,
            can_access_confidential: userData?.can_access_confidential === true,
        })
    ) {
        redirect('/manager/otp')
    }

    // Redirect based on role
    if (role === 'doctor') {
        redirect('/samples')
    }

    redirect(role === 'manager' ? '/manager' : '/analyst')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
