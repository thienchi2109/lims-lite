import { z } from 'zod'
import { isValidVietnamesePhone } from '@/lib/coa-auth'
import { isIsoDateString } from '@/lib/iso-date'
import { Gender } from './core'

export const ClientGovernmentIdentityTypeSchema = z.enum(['cccd', 'cmnd'])
export type ClientGovernmentIdentityType = z.infer<
  typeof ClientGovernmentIdentityTypeSchema
>

export const ClientResolutionCallerContextSchema = z.strictObject({
  sheet: z.string().min(1).max(120).optional(),
  row: z.number().int().positive().optional(),
  column: z.string().min(1).max(40).optional(),
  temporaryReference: z.string().min(1).max(120).optional(),
})
export type ClientResolutionCallerContext = z.infer<
  typeof ClientResolutionCallerContextSchema
>

const BirthDateSchema = z
  .string()
  .refine(isIsoDateString, 'Ngày sinh không hợp lệ')

const ExpiryDateSchema = z
  .string()
  .refine(isIsoDateString, 'Ngày hết hạn không hợp lệ')

export const ClientResolutionInputSchema = z
  .strictObject({
    governmentIdentityType:
      ClientGovernmentIdentityTypeSchema.nullable().optional(),
    governmentIdentityValue: z.string().max(80).nullable().optional(),
    name: z
      .string()
      .max(200)
      .refine((value) => value.trim().length > 0, 'Tên là bắt buộc'),
    dateOfBirth: BirthDateSchema,
    phone: z.string().max(30).nullable().optional(),
    callerContext: ClientResolutionCallerContextSchema.optional(),
  })
  .superRefine((data, context) => {
    const hasType = data.governmentIdentityType != null
    const hasValue =
      data.governmentIdentityValue != null &&
      data.governmentIdentityValue.trim().length > 0

    if (hasType !== hasValue) {
      context.addIssue({
        code: 'custom',
        path: hasType
          ? ['governmentIdentityValue']
          : ['governmentIdentityType'],
        message: 'Loại và số CCCD/CMND phải được cung cấp cùng nhau',
      })
    }

    if (hasType && hasValue) {
      const identityValue = data.governmentIdentityValue?.trim() ?? ''
      const identityPattern =
        data.governmentIdentityType === 'cccd' ? /^\d{12}$/ : /^\d{9}$/

      if (!identityPattern.test(identityValue)) {
        context.addIssue({
          code: 'custom',
          path: ['governmentIdentityValue'],
          message:
            data.governmentIdentityType === 'cccd'
              ? 'CCCD phải gồm đúng 12 chữ số'
              : 'CMND phải gồm đúng 9 chữ số',
        })
      }
    }
  })

export type ClientResolutionInput = z.infer<
  typeof ClientResolutionInputSchema
>

export const ResolveOrCreateClientInputSchema =
  ClientResolutionInputSchema.safeExtend({
    gender: Gender,
    phone: z
      .string()
      .max(30)
      .refine(
        (value) => isValidVietnamesePhone(value.trim()),
        'Số điện thoại không hợp lệ',
      ),
    address: z.string().max(500).nullable().optional(),
    healthInsuranceNum: z.string().max(80).nullable().optional(),
    expiryDate: ExpiryDateSchema.nullable().optional(),
  })

export type ResolveOrCreateClientInput = z.infer<
  typeof ResolveOrCreateClientInputSchema
>

export const ClientResolutionReasonCodeSchema = z.enum([
  'trusted_identity_match',
  'trusted_identity_not_found',
  'trusted_identity_ambiguous',
  'trusted_identity_disagreement',
  'name_dob_match',
  'identity_not_found',
  'name_dob_ambiguous',
  'inactive_candidate',
  'accent_only_conflict',
  'phone_conflict',
  'cross_key_conflict',
  'identity_conflict',
  'invalid_identity_input',
  'client_created',
])
export type ClientResolutionReasonCode = z.infer<
  typeof ClientResolutionReasonCodeSchema
>

const ExistingMatchSchema = z.strictObject({
  outcome: z.literal('matched'),
  reasonCode: z.enum(['trusted_identity_match', 'name_dob_match']),
  clientId: z.string().uuid(),
  created: z.literal(false),
})

const CreatedMatchSchema = z.strictObject({
  outcome: z.literal('matched'),
  reasonCode: z.literal('client_created'),
  clientId: z.string().uuid(),
  created: z.literal(true),
})

const NotFoundSchema = z.strictObject({
  outcome: z.literal('not_found'),
  reasonCode: z.enum([
    'trusted_identity_not_found',
    'identity_not_found',
  ]),
  clientId: z.null(),
  created: z.literal(false),
})

const AmbiguousSchema = z.strictObject({
  outcome: z.literal('ambiguous'),
  reasonCode: z.enum([
    'trusted_identity_ambiguous',
    'name_dob_ambiguous',
  ]),
  clientId: z.null(),
  created: z.literal(false),
})

const ConflictSchema = z.strictObject({
  outcome: z.literal('conflict'),
  reasonCode: z.enum([
    'trusted_identity_disagreement',
    'inactive_candidate',
    'accent_only_conflict',
    'phone_conflict',
    'cross_key_conflict',
    'identity_conflict',
    'invalid_identity_input',
  ]),
  clientId: z.null(),
  created: z.literal(false),
})

export const ClientResolutionResultSchema = z.union([
  ExistingMatchSchema,
  CreatedMatchSchema,
  NotFoundSchema,
  AmbiguousSchema,
  ConflictSchema,
])

export type ClientResolutionResult = z.infer<
  typeof ClientResolutionResultSchema
>
