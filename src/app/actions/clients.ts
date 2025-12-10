'use server'

import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    CreateClientSchema,
    type CreateClient,
    type Client,
} from '@/types'

/**
 * Upsert client by (name, date_of_birth)
 * Uses UNIQUE constraint to find existing or create new
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
 * Find client by name and date of birth
 */
export async function findClientByIdentity(name: string, date_of_birth: string) {
    try {
        const supabase = await createSupabaseClient()

        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .eq('name', name)
            .eq('date_of_birth', date_of_birth)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - not an error, just return null
                return { data: null }
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
 * Update client (Manager only)
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

        if (userData?.role !== 'manager') {
            return { error: 'Only managers can update clients' }
        }

        // Update client
        const { data: client, error } = await supabase
            .from('clients')
            .update(data)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error updating client:', error)
            return { error: error.message }
        }

        revalidatePath('/analyst/accession')
        revalidatePath('/samples')

        return { data: client as Client }
    } catch (error) {
        console.error('Error in updateClient:', error)
        return { error: error instanceof Error ? error.message : 'Failed to update client' }
    }
}
