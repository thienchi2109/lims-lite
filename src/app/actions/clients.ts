'use server'

import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isIsoDateString } from '@/lib/iso-date'
import { getUserConfidentialAccess } from '@/lib/data/confidential-samples'
import { filterConfidentialAssociatedClients } from '@/lib/data/confidential-clients'
import { classifyGovernmentIdentity } from '@/lib/client-resolution/accession'
import { localizeClientResolution } from '@/lib/client-resolution/messages'
import { resolveOrCreateClientV2 } from '@/lib/client-resolution/server'
import {
    ClientIdSchema,
    CreateClientSchema,
    UpdateClientSchema,
    type CreateClient,
    type Client,
    type ClientProfileUpdate,
} from '@/types'

const CLIENT_IDENTITY_UPDATE_ERROR =
    'Không thể cập nhật trực tiếp thông tin định danh; hãy dùng quy trình hiệu chỉnh danh tính'
const INVALID_CLIENT_ID_ERROR = 'ID khách hàng không hợp lệ'
const INVALID_CLIENT_UPDATE_ERROR =
    'Dữ liệu cập nhật hồ sơ khách hàng không hợp lệ'

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype
    )
}

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
        const resolution = await resolveOrCreateClientV2({
            ...classifyGovernmentIdentity(validatedData.id_card_num),
            name: validatedData.name,
            dateOfBirth: validatedData.date_of_birth,
            gender: validatedData.gender,
            phone: validatedData.phone,
            address: validatedData.address || null,
            healthInsuranceNum: validatedData.health_insurance_num || null,
            expiryDate: validatedData.expiry_date || null,
        })
        if ('error' in resolution) {
            return resolution
        }
        if (resolution.data.outcome !== 'matched' || !resolution.data.clientId) {
            const localized = localizeClientResolution(resolution.data)
            return {
                error: `${localized.label}: ${localized.message}`,
            }
        }

        const client = await getClient(resolution.data.clientId)
        if ('error' in client) return client
        revalidatePath('/analyst/accession')
        revalidatePath('/samples')
        return client
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
export async function updateClient(id: unknown, data: unknown) {
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
        const parsedId = ClientIdSchema.safeParse(id)
        if (!parsedId.success) {
            return { error: INVALID_CLIENT_ID_ERROR }
        }
        if (!isPlainObject(data)) {
            return { error: INVALID_CLIENT_UPDATE_ERROR }
        }
        if (
            Object.prototype.hasOwnProperty.call(data, 'id_card_num') ||
            Object.prototype.hasOwnProperty.call(data, 'name') ||
            Object.prototype.hasOwnProperty.call(data, 'date_of_birth')
        ) {
            return { error: CLIENT_IDENTITY_UPDATE_ERROR }
        }
        const parsedUpdate = UpdateClientSchema.safeParse(data)
        if (!parsedUpdate.success) {
            return { error: INVALID_CLIENT_UPDATE_ERROR }
        }
        const validatedData: ClientProfileUpdate = parsedUpdate.data
        const updateData: Record<string, unknown> = {}
        if (validatedData.gender !== undefined) updateData.gender = validatedData.gender
        if (validatedData.phone !== undefined) updateData.phone = validatedData.phone
        if (validatedData.address !== undefined) updateData.address = validatedData.address || null
        if (validatedData.health_insurance_num !== undefined) updateData.health_insurance_num = validatedData.health_insurance_num || null
        if (validatedData.expiry_date !== undefined) updateData.expiry_date = validatedData.expiry_date || null
        const { data: client, error } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', parsedId.data)
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
