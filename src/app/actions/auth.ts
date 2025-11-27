'use server'

import { createClient } from '@/lib/supabase/server'
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

    const { username, password } = validation.data

    // Map username to the seeded auth email (usernames don't exist in auth.users)
    // Allow logging in with either the full email or just the username.
    const emailSuffix = '@cdc-lims.local'
    const email = username.includes('@') ? username : `${username}${emailSuffix}`

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
