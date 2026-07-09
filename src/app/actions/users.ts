'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CreateUserSchema, UpdateUserSchema, PaginationSchema } from '@/types'
import { z } from 'zod'
import type { UserAttributes } from '@supabase/supabase-js'

type UserManagementSupabase = Awaited<ReturnType<typeof createClient>>
type UserManagementProfile = {
    id?: string
    role?: string | null
}

async function fetchUserManagementProfile(
    supabase: UserManagementSupabase,
    userId: string,
    errorPrefix: string,
): Promise<UserManagementProfile> {
    const { data, error } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .single()

    if (error) throw new Error(`${errorPrefix}: ${error.message}`)
    if (!data) throw new Error(`${errorPrefix}: User not found`)

    return { ...data, id: data.id ?? userId }
}

async function requireCurrentManager(
    supabase: UserManagementSupabase,
    currentUser: { id: string } | null,
    action: 'create' | 'update' | 'delete',
) {
    if (!currentUser) throw new Error('Unauthorized')

    const profile = await fetchUserManagementProfile(
        supabase,
        currentUser.id,
        'Authorization failed',
    )

    if (profile.role !== 'manager') {
        throw new Error(`Unauthorized: Only managers can ${action} users`)
    }

    return { id: currentUser.id, role: profile.role }
}

function assertManagerTargetAllowed(currentManagerId: string, targetProfile: UserManagementProfile) {
    if (targetProfile.role === 'manager' && targetProfile.id !== currentManagerId) {
        throw new Error('Unauthorized: Managers cannot modify other manager accounts')
    }
}

/**
 * Get users with pagination and filtering
 */
export async function getUsers(params: z.infer<typeof PaginationSchema> & { role?: string }) {
    const supabase = await createClient()

    // Verify manager role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'manager') {
        throw new Error('Unauthorized: Manager access required')
    }

    // Build query with signature status
    let query = supabase
        .from('users')
        .select(`
            *,
            user_signatures!left(id, is_active, uploaded_at)
        `, { count: 'exact' })
        .is('deleted_at', null) // Exclude soft-deleted

    if (params.search) {
        query = query.or(`username.ilike.%${params.search}%,full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`)
    }

    if (params.role) {
        query = query.eq('role', params.role)
    }

    if (params.sortBy) {
        query = query.order(params.sortBy, { ascending: params.sortOrder === 'asc' })
    } else {
        query = query.order('created_at', { ascending: false })
    }

    const from = (params.page - 1) * params.pageSize
    const to = from + params.pageSize - 1

    const { data, count, error } = await query.range(from, to)

    if (error) throw new Error(`Failed to fetch users: ${error.message}`)

    return {
        data,
        count: count || 0,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: count ? Math.ceil(count / params.pageSize) : 0
    }
}

/**
 * Get a single user by ID
 */
export async function getUser(id: string) {
    const supabase = await createClient()

    // Verify manager role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'manager') {
        throw new Error('Unauthorized: Manager access required')
    }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw new Error(`Failed to fetch user: ${error.message}`)
    return data
}

/**
 * Create a new user (Auth + Profile)
 */
export async function createUser(data: z.infer<typeof CreateUserSchema>) {
    // Validate input
    const validated = CreateUserSchema.parse(data)

    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    await requireCurrentManager(supabase, currentUser, 'create')

    const adminClient = createAdminClient()

    // 1. Create in Supabase Auth
    const email = validated.email || `${validated.username}@cdc-lims.local`

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: email,
        password: validated.password,
        email_confirm: true,
        user_metadata: {
            full_name: validated.full_name,
            username: validated.username, // helpful for metadata
        }
    })

    if (authError) {
        const message = authError.message || 'Unknown error'
        const normalized = message.toLowerCase()

        if (
            normalized.includes('email') &&
            (normalized.includes('already been registered') ||
                normalized.includes('already registered') ||
                normalized.includes('already exists'))
        ) {
            throw new Error('Email này đã được đăng ký. Vui lòng sử dụng email khác.')
        }

        if (normalized.includes('invalid jwt')) {
            throw new Error(
                [
                    'Auth creation failed: invalid JWT.',
                    'Nguyên nhân thường gặp: `SERVICE_ROLE_KEY`/`ANON_KEY` không khớp với `JWT_SECRET` trong Docker (chữ ký JWT không hợp lệ).',
                    'Cách sửa: chạy `node scripts/sync-supabase-jwt-keys.js`, rồi restart Docker + restart Next.js và đăng nhập lại.',
                ].join(' ')
            )
        }
        throw new Error(`Auth creation failed: ${message}`)
    }
    if (!authUser.user) throw new Error('Auth creation failed: No user returned')

    // 2. Create in public.users
    // Note: The ID must match the auth user ID
    const { error: dbError } = await supabase
        .from('users')
        .insert({
            id: authUser.user.id,
            username: validated.username,
            full_name: validated.full_name,
            role: validated.role,
            email: email,
            lab: validated.lab || 'Central Lab',
            can_access_confidential: false,
        })

    if (dbError) {
        // Rollback auth user creation if DB insert fails
        await adminClient.auth.admin.deleteUser(authUser.user.id)
        throw new Error(`Database profile creation failed: ${dbError.message}`)
    }

    if (validated.role === 'manager') {
        const { error: otpSettingsError } = await adminClient
            .from('manager_otp_settings')
            .upsert({
                user_id: authUser.user.id,
                otp_email: email,
                updated_at: new Date().toISOString(),
            })

        if (otpSettingsError) {
            await adminClient.auth.admin.deleteUser(authUser.user.id)
            throw new Error(`Manager OTP email configuration failed: ${otpSettingsError.message}`)
        }
    }

    revalidatePath('/manager/users')
    return { success: true, userId: authUser.user.id }
}

/**
 * Update a user
 */
export async function updateUser(data: z.infer<typeof UpdateUserSchema>) {
    const validated = UpdateUserSchema.parse(data)
    
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    const currentManager = await requireCurrentManager(supabase, currentUser, 'update')
    const targetProfile = await fetchUserManagementProfile(
        supabase,
        validated.id,
        'Failed to fetch target user',
    )
    assertManagerTargetAllowed(currentManager.id, targetProfile)

    if (validated.can_access_confidential !== undefined) {
        throw new Error('Unauthorized: Managers cannot change confidential access')
    }

    // Update public profile
    const updateData: Partial<Pick<z.infer<typeof UpdateUserSchema>, 'full_name' | 'role' | 'email' | 'lab'>> = {}
    if (validated.full_name) updateData.full_name = validated.full_name
    if (validated.role) updateData.role = validated.role
    if (validated.email) updateData.email = validated.email
    if (validated.lab) updateData.lab = validated.lab

    if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', validated.id)
        
        if (error) throw new Error(`Update failed: ${error.message}`)
    }

    // Update Auth (Email/Password) if needed
    // Requires Admin client
    if (validated.email || validated.password) {
        const adminClient = createAdminClient()
        const authUpdates: UserAttributes = {}
        if (validated.email) authUpdates.email = validated.email
        if (validated.password) authUpdates.password = validated.password

        const { error: authError } = await adminClient.auth.admin.updateUserById(
            validated.id,
            authUpdates
        )

        if (authError) throw new Error(`Auth update failed: ${authError.message}`)
    }

    revalidatePath('/manager/users')
    return { success: true }
}

/**
 * Soft delete a user
 */
export async function deleteUser(userId: string) {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    const currentManager = await requireCurrentManager(supabase, currentUser, 'delete')

    // Prevent self-deletion
    if (userId === currentManager.id) {
        throw new Error('Cannot delete your own account')
    }

    const targetProfile = await fetchUserManagementProfile(
        supabase,
        userId,
        'Failed to fetch target user',
    )
    assertManagerTargetAllowed(currentManager.id, targetProfile)

    // Soft delete in DB
    const { error } = await supabase
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', userId)

    if (error) throw new Error(`Delete failed: ${error.message}`)

    // Revoke access in Auth (Ban user)
    const adminClient = createAdminClient()
    const { error: banError } = await adminClient.auth.admin.updateUserById(
        userId,
        { ban_duration: '876600h' } // 100 years ban
    )

    if (banError) {
        console.error('Failed to ban user in Auth:', banError)
        // We continue since DB soft-delete succeeded
    }

    revalidatePath('/manager/users')
    return { success: true }
}
