'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { LoginSchema } from '@/types'
import { redirect } from 'next/navigation'

export async function login(prevState: any, formData: FormData) {
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

    // Get user role
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()

    const role = userData?.role || 'analyst'

    // Redirect based on role
    redirect(role === 'manager' ? '/manager' : '/analyst')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
