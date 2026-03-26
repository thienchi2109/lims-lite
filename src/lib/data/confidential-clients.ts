import { createAdminClient } from '@/lib/supabase/server'
import { getConfidentialAssociatedSampleIds } from './confidential-samples'
import type { Client } from '@/types'

type SampleClientLink = {
    id: string
    client_id: string
}

async function getConfidentialAssociatedClientIds(clientIds: string[]) {
    if (clientIds.length === 0) {
        return new Set<string>()
    }

    const adminClient = createAdminClient()
    const { data: sampleLinks, error } = await adminClient
        .from('samples')
        .select('id, client_id')
        .in('client_id', clientIds)

    if (error) {
        console.error('Error fetching samples for confidential client filtering:', error)
        throw new Error('Failed to evaluate confidential client association')
    }

    const linkedSamples = (sampleLinks ?? []) as SampleClientLink[]
    if (linkedSamples.length === 0) {
        return new Set<string>()
    }

    const confidentialSampleIds = await getConfidentialAssociatedSampleIds(
        linkedSamples.map((sample) => sample.id),
    )

    return new Set(
        linkedSamples
            .filter((sample) => confidentialSampleIds.data.has(sample.id))
            .map((sample) => sample.client_id),
    )
}

export async function filterConfidentialAssociatedClients(
    clients: Client[],
    canAccessConfidential: boolean,
    errorMessage: string,
): Promise<{ data: Client[]; error?: string }> {
    if (canAccessConfidential || clients.length === 0) {
        return { data: clients }
    }

    try {
        const hiddenClientIds = await getConfidentialAssociatedClientIds(
            clients.map((client) => client.id),
        )

        if (hiddenClientIds.size === 0) {
            return { data: clients }
        }

        return {
            data: clients.filter((client) => !hiddenClientIds.has(client.id)),
        }
    } catch (error) {
        console.error('Error verifying confidential client associations:', error)
        return {
            data: [],
            error: errorMessage,
        }
    }
}
