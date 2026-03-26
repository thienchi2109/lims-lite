'use server'

import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isIsoDateString } from '@/lib/iso-date'
import { getUserConfidentialAccess } from '@/lib/data/confidential-samples'
import { filterConfidentialAssociatedClients } from '@/lib/data/confidential-clients'
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
        const access = await getUserConfidentialAccess(user.id, supabase)
        if (access.error) {
            return { error: access.error }
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
            if (error.code === 'PGRST116') {
                return { error: 'Client không tìm thấy' }
            }
            console.error('Error fetching client:', error)
            return { error: error.message }
        }
        const visibleClient = await filterConfidentialAssociatedClients(
            client ? [client as Client] : [],
            access.canAccessConfidential,
            'Client không tìm thấy',
        )
        if (visibleClient.error) {
            return { error: visibleClient.error }
        }
        return visibleClient.data[0]
            ? { data: visibleClient.data[0] }
            : { error: 'Client không tìm thấy' }
    } catch (error) {
        console.error('Error in getClient:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch client' }
    }
}

export async function upsertClient(data: CreateClient) {
    try {
        const supabase = await createSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }
        const validatedData = CreateClientSchema.parse(data)
        if (validatedData.phone && validatedData.phone !== '0000000000') {
            const { data: existingByPhone } = await supabase
                .from('clients')
                .select('id, name, date_of_birth')
                .eq('phone', validatedData.phone)
                .single()
            if (existingByPhone) {
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
                    ignoreDuplicates: false,
                }
            )
            .select()
            .single()
        if (error) {
            console.error('Error upserting client:', error)
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
export async function findClientByPhone(phone: string) {
    try {
        const supabase = await createSupabaseClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }
        const access = await getUserConfidentialAccess(user.id, supabase)
        if (access.error) {
            return { error: access.error }
        }
        const trimmedPhone = phone.trim()
        if (!trimmedPhone || trimmedPhone.length < 10) {
            return { data: null }
        }
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
                return { data: null }
            }
            console.error('Error finding client by phone:', error)
            return { error: error.message }
        }
        const visibleClient = await filterConfidentialAssociatedClients(
            client ? [client as Client] : [],
            access.canAccessConfidential,
            'Failed to find client',
        )
        if (visibleClient.error) {
            return { error: visibleClient.error }
        }
        return { data: visibleClient.data[0] ?? null }
    } catch (error) {
        console.error('Error in findClientByPhone:', error)
        return { error: error instanceof Error ? error.message : 'Failed to find client' }
    }
}
export async function findClientByIdentity(name: string, date_of_birth: string) {
    try {
        const supabase = await createSupabaseClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }
        const access = await getUserConfidentialAccess(user.id, supabase)
        if (access.error) {
            return { error: access.error }
        }
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
                return { data: null }
            }
            if (error.code === '22007') {
                return { error: 'Ngày sinh không hợp lệ' }
            }
            console.error('Error finding client:', error)
            return { error: error.message }
        }
        const visibleClient = await filterConfidentialAssociatedClients(
            client ? [client as Client] : [],
            access.canAccessConfidential,
            'Failed to find client',
        )
        if (visibleClient.error) {
            return { error: visibleClient.error }
        }
        return { data: visibleClient.data[0] ?? null }
    } catch (error) {
        console.error('Error in findClientByIdentity:', error)
        return { error: error instanceof Error ? error.message : 'Failed to find client' }
    }
}
export async function getClients(search?: string) {
    try {
        const supabase = await createSupabaseClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }
        const access = await getUserConfidentialAccess(user.id, supabase)
        if (access.error) {
            return { error: access.error }
        }
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
        const visibleClients = await filterConfidentialAssociatedClients(
            (clients ?? []) as Client[],
            access.canAccessConfidential,
            'Failed to fetch clients',
        )
        if (visibleClients.error) {
            return { error: visibleClients.error }
        }
        return { data: visibleClients.data }
    } catch (error) {
        console.error('Error in getClients:', error)
        return { error: error instanceof Error ? error.message : 'Failed to fetch clients' }
    }
}
export async function updateClient(id: string, data: Partial<CreateClient>) {
    try {
        const supabase = await createSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }
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
