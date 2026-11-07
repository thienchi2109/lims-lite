// Safe row failures cross the browser boundary intact; malformed transport bodies fail closed.
import { z } from 'zod'

const location = z.strictObject({ sheet: z.string().nullable(), row: z.number().int().positive().safe().nullable(),
    column: z.string().nullable(), header: z.string().nullable(), temporaryReference: z.string().nullable() })
export const PreviewValidationResponseSchema = z.strictObject({ ok: z.literal(false), batchId: z.string().uuid(),
    errors: z.array(location.extend({ code: z.string().regex(/^[A-Z][A-Z0-9_]*$/), message: z.string(),
        relatedLocations: z.array(location).optional() })).min(1) })

// Shared browser/server allowlist; SQL and authenticated server guards own actor authorization.
export const accessionBatchIdSchema = z.string().uuid()
const count = z.number().int().nonnegative().safe()
export const accessionReceiptSchema = z.strictObject({ batch_id: accessionBatchIdSchema, owner_id: accessionBatchIdSchema,
    confirmation_received_at: z.string().datetime({ offset: true }), client_count: count.positive(), sample_count: count.positive(),
    assignment_count: count.positive(), create_count: count, reuse_count: count })
export const accessionReceiptSamplesSchema = z.strictObject({ batchId: accessionBatchIdSchema,
    samples: z.array(z.strictObject({ row: count.positive(), sampleId: accessionBatchIdSchema,
        officialSampleIdentifier: z.string().min(1) })).min(1).refine(samples =>
        new Set(samples.map(sample => sample.row)).size === samples.length
        && new Set(samples.map(sample => sample.sampleId)).size === samples.length
        && new Set(samples.map(sample => sample.officialSampleIdentifier)).size === samples.length),
})
export type AccessionReceiptSamples = z.infer<typeof accessionReceiptSamplesSchema>
const reasonCode = z.enum(['WORKBOOK_INVALID', 'CLIENT_INVALID', 'PREPARATION_FAILED', 'ALREADY_IMPORTED', 'AUTHORITY_CHANGED',
    'CONFIRMATION_FAILED', 'PREVIEW_CONTENT_CHANGED', 'ATTESTATION_REQUIRED', 'CONFIGURATION_UNAVAILABLE', 'EXPIRED'])
export const accessionConfirmationStatusSchema = z.union([
    z.strictObject({ state: z.literal('succeeded'), receipt: accessionReceiptSchema }),
    z.strictObject({ state: z.enum(['preparing', 'preview_ready', 'processing', 'unknown']), batchId: accessionBatchIdSchema }),
    z.strictObject({ state: z.enum(['rejected', 'failed', 'expired']), batchId: accessionBatchIdSchema, reasonCode: reasonCode.optional() }),
])
export type AccessionConfirmationStatus = z.infer<typeof accessionConfirmationStatusSchema>
