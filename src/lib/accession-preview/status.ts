// File-free, owner-bound committed status. SQL owns lock/expiry and confidentiality decisions.
import 'server-only'
import { z } from 'zod'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import { createAdminClient } from '@/lib/supabase/server'
import { accessionReceiptSchema } from './confirmation'

const batchIdSchema = z.string().uuid()
const reasonCode = z.enum(['WORKBOOK_INVALID', 'CLIENT_INVALID', 'PREPARATION_FAILED', 'ALREADY_IMPORTED', 'AUTHORITY_CHANGED',
    'CONFIRMATION_FAILED', 'PREVIEW_CONTENT_CHANGED', 'ATTESTATION_REQUIRED', 'CONFIGURATION_UNAVAILABLE', 'EXPIRED'])
export const accessionConfirmationStatusSchema = z.union([
    z.strictObject({ state: z.literal('succeeded'), receipt: accessionReceiptSchema }),
    z.strictObject({ state: z.enum(['preparing', 'preview_ready', 'processing', 'unknown']), batchId: batchIdSchema }),
    z.strictObject({ state: z.enum(['rejected', 'failed', 'expired']), batchId: batchIdSchema, reasonCode: reasonCode.optional() }),
])
export type AccessionConfirmationStatus = z.infer<typeof accessionConfirmationStatusSchema>

export async function getAccessionConfirmationStatus(batchId: string): Promise<AccessionConfirmationStatus> {
    const actor = await requireRole('analyst')
    if (isAuthError(actor) || actor.role !== 'analyst') throw new Error('ACCESSION_CONFIRMATION_FORBIDDEN')
    batchIdSchema.parse(batchId)
    try {
        const result = await createAdminClient().rpc('get_accession_import_status', { p_actor: actor.id, p_batch: batchId })
        if (result.error?.code === '42501') throw new Error('ACCESSION_CONFIRMATION_FORBIDDEN')
        if (result.error) throw new Error()
        const parsed = accessionConfirmationStatusSchema.parse(result.data)
        if (parsed.state === 'succeeded') {
            if (parsed.receipt.batch_id !== batchId || parsed.receipt.owner_id !== actor.id
                || parsed.receipt.client_count !== parsed.receipt.create_count + parsed.receipt.reuse_count) throw new Error()
        } else if (parsed.batchId !== batchId) throw new Error()
        return parsed
    } catch (error) {
        if (error instanceof Error && error.message === 'ACCESSION_CONFIRMATION_FORBIDDEN') throw error
        return { state: 'unknown', batchId }
    }
}
