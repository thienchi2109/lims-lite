'use server'

import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isIsoDateString } from '@/lib/iso-date'
import {
    CreateClientSchema,
    UpdateClientSchema,
    type CreateClient,
    type Client,
} from '@/types'

export async function getClient(id: string) {
    try {
        const supabase = await createSupabaseClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        if (!id || !id.match(/^[0-9a-fA-F-]{36}$/)) {
            return { error: 'Client ID không hợp lệ' }
        }

        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            console.error('Error fetching client:', error)
            return { error: error.message }
        }

        return { data: client as Client }
    } catch (error) {
        console.error('Error in getClient:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch client' }
    }
}

/**
 * Upsert client by (name, date_of_birth)
 * Uses UNIQUE constraint to find existing or create new
 * Also checks for phone number conflicts to prevent duplicates
 */
export async function upsertClient(data: CreateClient) {
    try {
        const supabase = await createSupabaseClient()

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Validate input
        const validatedData = CreateClientSchema.parse(data)

        // Check if phone number already belongs to a different client
        if (validatedData.phone && validatedData.phone !== '0000000000') {
            const { data: existingByPhone } = await supabase
                .from('clients')
                .select('id, name, date_of_birth')
                .eq('phone', validatedData.phone)
                .single()

            if (existingByPhone) {
                // Check if it's a different person (different name or DOB)
                const isSamePerson =
                    existingByPhone.name.toLowerCase() === validatedData.name.toLowerCase() &&
                    existingByPhone.date_of_birth === validatedData.date_of_birth

                if (!isSamePerson) {
                    return {
                        error: `Số điện thoại ${validatedData.phone} đã được sử dụng bởi khách hàng "${existingByPhone.name}". Vui lòng sử dụng số điện thoại khác hoặc chọn khách hàng hiện có.`,
                        existingClient: existingByPhone,
                    }
                }
            }
        }

        // Attempt INSERT, if conflict on (name, DOB) then UPDATE
        const { data: client, error } = await supabase
            .from('clients')
            .upsert(
                {
                    id_card_num: validatedData.id_card_num,
                    name: validatedData.name,
                    date_of_birth: validatedData.date_of_birth,
                    gender: validatedData.gender,
                    phone: validatedData.phone,
                    address: validatedData.address || null,
                    health_insurance_num: validatedData.health_insurance_num || null,
                    expiry_date: validatedData.expiry_date || null,
                },
                {
                    onConflict: 'name,date_of_birth',
                    ignoreDuplicates: false, // Update if exists
                }
            )
            .select()
            .single()

        if (error) {
            console.error('Error upserting client:', error)
            // Handle unique constraint violation on phone
            if (error.code === '23505' && error.message.includes('phone')) {
                return { error: 'Số điện thoại này đã được sử dụng bởi khách hàng khác' }
            }
            return { error: error.message }
        }

        revalidatePath('/analyst/accession')
        revalidatePath('/samples')

        return { data: client as Client }
    } catch (error) {
        console.error('Error in upsertClient:', error)
        return { error: error instanceof Error ? error.message : 'Failed to save client' }
    }
}

/**
 * Find client by phone number
 * Returns existing client if phone already exists (for duplicate prevention)
 */
export async function findClientByPhone(phone: string) {
    try {
        const supabase = await createSupabaseClient()

        const trimmedPhone = phone.trim()
        if (!trimmedPhone || trimmedPhone.length < 10) {
            return { data: null }
        }

        // Skip placeholder phones
        if (trimmedPhone === '0000000000') {
            return { data: null }
        }

        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .eq('phone', trimmedPhone)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - not an error, just return null
                return { data: null }
            }
            console.error('Error finding client by phone:', error)
            return { error: error.message }
        }

        return { data: client as Client }
    } catch (error) {
        console.error('Error in findClientByPhone:', error)
        return { error: error instanceof Error ? error.message : 'Failed to find client' }
    }
}

/**
 * Find client by name and date of birth
 */
export async function findClientByIdentity(name: string, date_of_birth: string) {
    try {
        const supabase = await createSupabaseClient()

        const trimmedName = name.trim()
        if (!trimmedName) {
            return { error: 'Tên là bắt buộc' }
        }

        if (!isIsoDateString(date_of_birth)) {
            return { error: 'Ngày sinh không hợp lệ' }
        }

        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .eq('name', trimmedName)
            .eq('date_of_birth', date_of_birth)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - not an error, just return null
                return { data: null }
            }
            if (error.code === '22007') {
                return { error: 'Ngày sinh không hợp lệ' }
            }
            console.error('Error finding client:', error)
            return { error: error.message }
        }

        return { data: client as Client }
    } catch (error) {
        console.error('Error in findClientByIdentity:', error)
        return { error: error instanceof Error ? error.message : 'Failed to find client' }
    }
}

/**
 * Get all clients with optional search
 */
export async function getClients(search?: string) {
    try {
        const supabase = await createSupabaseClient()

        let query = supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false })

        if (search) {
            query = query.or(`name.ilike.%${search}%,id_card_num.ilike.%${search}%,phone.ilike.%${search}%`)
        }

        const { data: clients, error } = await query

        if (error) {
            console.error('Error fetching clients:', error)
            return { error: error.message }
        }

        return { data: clients as Client[] }
    } catch (error) {
        console.error('Error in getClients:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch clients' }
    }
}

/**
 * Update client (Analysts and managers)
 */
export async function updateClient(id: string, data: Partial<CreateClient>) {
    try {
        const supabase = await createSupabaseClient()

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Check user role
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager' && userData?.role !== 'analyst') {
            return { error: 'Only analysts and managers can update clients' }
        }

        const validatedData = UpdateClientSchema.parse({ id, ...data })

        const updateData: Record<string, unknown> = {}
        if (validatedData.id_card_num !== undefined) updateData.id_card_num = validatedData.id_card_num
        if (validatedData.name !== undefined) updateData.name = validatedData.name
        if (validatedData.date_of_birth !== undefined) updateData.date_of_birth = validatedData.date_of_birth
        if (validatedData.gender !== undefined) updateData.gender = validatedData.gender
        if (validatedData.phone !== undefined) updateData.phone = validatedData.phone
        if (validatedData.address !== undefined) updateData.address = validatedData.address || null
        if (validatedData.health_insurance_num !== undefined) updateData.health_insurance_num = validatedData.health_insurance_num || null
        if (validatedData.expiry_date !== undefined) updateData.expiry_date = validatedData.expiry_date || null

        const { data: client, error } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error updating client:', error)
            return { error: error.message }
        }

        if (updateData.name) {
            const { error: samplesError } = await supabase
                .from('samples')
                .update({ client_name: client.name })
                .eq('client_id', id)

            if (samplesError) {
                console.error('Error syncing samples client_name:', samplesError)
            }
        }

        revalidatePath('/analyst/accession')
        revalidatePath('/samples')

        return { data: client as Client }
    } catch (error) {
        console.error('Error in updateClient:', error)
        return { error: error instanceof Error ? error.message : 'Failed to update client' }
    }
}
