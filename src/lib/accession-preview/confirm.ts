// Trusted server adapter: one atomic service handoff, no HTTP surface and no automatic retry.
import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { accessionReceiptSchema, ConfirmationPreparationFailure, prepareAccessionConfirmation } from './confirmation'

const resultSchema = z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('succeeded'), receipt: accessionReceiptSchema }),
    z.strictObject({ state: z.literal('failed'), batchId: z.string().uuid(), reasonCode: z.enum([
        'ALREADY_IMPORTED', 'AUTHORITY_CHANGED', 'CONFIRMATION_FAILED', 'PREVIEW_CONTENT_CHANGED', 'ATTESTATION_REQUIRED', 'CONFIGURATION_UNAVAILABLE']) }),
    z.strictObject({ state: z.literal('expired'), batchId: z.string().uuid(), reasonCode: z.literal('EXPIRED') }),
])
export async function confirmAccession(batchId: string, source?: Uint8Array, acceptableQuality?: boolean) {
    let prepared
    try { prepared = await prepareAccessionConfirmation(batchId, source, acceptableQuality) }
    catch (error) {
        if (!(error instanceof ConfirmationPreparationFailure)) throw error
        prepared = error
    }
    if (!(prepared instanceof ConfirmationPreparationFailure) && prepared.kind === 'receipt') {
        return { state: 'succeeded' as const, receipt: prepared.receipt }
    }
    const failure = prepared instanceof ConfirmationPreparationFailure ? prepared : null
    const handoff = prepared instanceof ConfirmationPreparationFailure ? null : prepared
    const args = { p_actor: prepared.actorId, p_batch: prepared.batchId, p_attested: handoff?.attested ?? false,
        p_workbook: handoff?.workbook ?? null, p_snapshot: handoff?.snapshot ?? null, p_clients: handoff?.clients ?? null,
        p_expected_clients: handoff?.expectedClients ?? null, p_canonical_intent: handoff?.canonicalIntent ?? null,
        p_bindings_text: handoff?.bindingsText ?? null, p_metadata: handoff?.metadata ?? null, p_preparation_failure: failure?.reasonCode ?? null }
    try {
        const result = await createAdminClient().rpc('confirm_accession_import', args)
        if (result.error) throw new Error()
        const parsed = resultSchema.parse(result.data)
        if (parsed.state === 'succeeded') {
            if (parsed.receipt.batch_id !== batchId || parsed.receipt.owner_id !== prepared.actorId
                || parsed.receipt.client_count !== parsed.receipt.create_count + parsed.receipt.reuse_count) throw new Error()
        } else if (parsed.batchId !== batchId) throw new Error()
        return parsed
    } catch { throw new Error('ACCESSION_CONFIRMATION_OUTCOME_UNKNOWN') }
}
