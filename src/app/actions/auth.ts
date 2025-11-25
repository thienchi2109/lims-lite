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

    // In Supabase, we need to get the email from username
    // For now, we'll use a workaround: username@lims.local
    // In production, you'd query the users table first
    const email = `${username}@lims.local`

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
    redirect(role === 'manager' ? '/dashboard/manager' : '/dashboard/analyst')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
