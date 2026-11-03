// Request-local SQL bridge contract. These identity/profile values must never be persisted or logged.
import { z } from 'zod'
import { ClientResolutionInputSchema, ClientResolutionResultSchema, ResolveOrCreateClientInputSchema } from '@/types/client-resolution'
import { isValidVietnamesePhone } from '@/lib/coa-auth'
import { isSupportedLiteral } from '@/lib/accession-workbook/strings'

const creation = ResolveOrCreateClientInputSchema.shape
export const PreviewClientInputSchema = ClientResolutionInputSchema.safeExtend({
    governmentIdentityType: ClientResolutionInputSchema.shape.governmentIdentityType.nonoptional(),
    governmentIdentityValue: ClientResolutionInputSchema.shape.governmentIdentityValue.nonoptional(),
    gender: creation.gender.nullable(),
    phone: ClientResolutionInputSchema.shape.phone.nonoptional().refine(value => value == null || isValidVietnamesePhone(value)),
    address: creation.address.nonoptional(), healthInsuranceNum: creation.healthInsuranceNum.nonoptional(), expiryDate: creation.expiryDate.nonoptional(),
}).refine(value => Object.values(value).every(field => typeof field !== 'string' || isSupportedLiteral(field)))

export const PreviewClientRowSchema = z.strictObject({
    row: z.number().int().positive().safe(),
    input: PreviewClientInputSchema,
    resolution: ClientResolutionResultSchema.refine(value => !value.created),
    trustedIdentity: z.strictObject({ type: z.enum(['cccd', 'cmnd']), value: z.string(), trusted: z.literal(true) })
        .refine(value => (value.type === 'cccd' ? /^\d{12}$/ : /^\d{9}$/).test(value.value)).nullable(),
    // Existing display values are fingerprint inputs, not a new-client validation request.
    displayValues: z.record(z.enum(['name', 'dateOfBirth', 'governmentIdentityType', 'governmentIdentityValue',
        'gender', 'phone', 'address', 'healthInsuranceNum', 'expiryDate']), z.string().nullable()).nullable(),
    issues: z.array(z.strictObject({
        code: z.enum(['CLIENT_DUPLICATE', 'CLIENT_CONFLICT']),
        reasonCode: z.enum(['same_uuid', 'same_trusted_identity', 'trusted_identity_disagreement', 'identity_conflict', 'cross_key_conflict', 'accent_only_conflict', 'phone_conflict']),
        relatedRows: z.array(z.number().int().positive().safe()).min(1).max(1),
    })).max(1),
}).refine(value => value.resolution.outcome === 'matched'
    ? value.displayValues !== null
    : value.displayValues === null && value.trustedIdentity === null)

export type PreviewClientInput = z.infer<typeof PreviewClientInputSchema>
export type PreviewClientRow = z.infer<typeof PreviewClientRowSchema>
