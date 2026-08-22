import { z } from 'zod'

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const IsoDateTimeSchema = z.string().datetime({ offset: true })
const LifecycleReasonSchema = z
  .string()
  .trim()
  .min(8, 'Lý do phải có ít nhất 8 ký tự')
  .max(500, 'Lý do không được vượt quá 500 ký tự')

export const ClientLifecycleStatusSchema = z.enum(['active', 'inactive'])
export const ClientCollisionReasonSchema = z.enum([
  'government_identity',
  'legacy_identity',
  'phone',
  'name_date_of_birth',
  'restricted',
])
export const ClientCollisionTypeSchema = z.enum([
  'government_identity',
  'phone',
  'name_date_of_birth',
])
export const ClientCollisionEvidenceLevelSchema = z.enum([
  'trusted',
  'legacy_identity',
])
export const ClientCollisionDispositionSchema = z.enum([
  'confirmed_distinct',
  'correction_required',
])

export const ClientCollisionCandidateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  maskedIdentity: z.string(),
  maskedPhone: z.string(),
  status: ClientLifecycleStatusSchema,
  updatedAt: IsoDateTimeSchema,
  evidenceLevel: ClientCollisionEvidenceLevelSchema,
  collisionReasons: z.array(ClientCollisionTypeSchema),
})

export const ClientLifecycleManagerRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  dateOfBirth: IsoDateSchema,
  gender: z.enum(['Nam', 'Nữ', 'Khác']),
  maskedIdentity: z.string(),
  maskedPhone: z.string(),
  status: ClientLifecycleStatusSchema,
  deletedAt: IsoDateTimeSchema.nullable(),
  deletionReason: z.string().nullable(),
  updatedAt: IsoDateTimeSchema,
  sampleCount: z.number().int().nonnegative(),
  collisionReasons: z.array(ClientCollisionReasonSchema),
  collisionCandidates: z.array(ClientCollisionCandidateSchema),
})

export const ClientLifecycleManagerDataSchema = z.object({
  clients: z.array(ClientLifecycleManagerRowSchema),
  total: z.number().int().nonnegative(),
  activeCount: z.number().int().nonnegative(),
  inactiveCount: z.number().int().nonnegative(),
  collisionCount: z.number().int().nonnegative(),
})

export const GetClientLifecycleManagerSchema = z.object({
  status: z.enum(['all', 'active', 'inactive', 'collision']).default('all'),
  search: z.string().trim().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

export const GetClientLifecycleDetailSchema = z.object({
  clientId: z.string().uuid(),
})

export const ClientLifecycleDetailSchema = z.object({
  id: z.string().uuid(),
  idCardNum: z.string(),
  name: z.string().min(1),
  dateOfBirth: IsoDateSchema,
  gender: z.enum(['Nam', 'Nữ', 'Khác']),
  phone: z.string(),
  status: ClientLifecycleStatusSchema,
  updatedAt: IsoDateTimeSchema,
})

const LifecycleMutationBaseSchema = z.object({
  clientId: z.string().uuid(),
  expectedUpdatedAt: IsoDateTimeSchema,
  reason: LifecycleReasonSchema,
})

export const DeactivateClientSchema = LifecycleMutationBaseSchema
export const RestoreClientSchema = LifecycleMutationBaseSchema

export const CorrectClientIdentitySchema = LifecycleMutationBaseSchema.extend({
  idCardNum: z.string().regex(
    /^(?:\d{9}|\d{12})$/,
    'Số CCCD/CMND phải gồm 12 hoặc 9 chữ số',
  ),
  name: z.string().trim().min(1, 'Tên khách hàng là bắt buộc').max(200),
  dateOfBirth: IsoDateSchema,
  gender: z.enum(['Nam', 'Nữ', 'Khác']),
  phone: z
    .string()
    .regex(/^(?:0\d{9,10}|\+84\d{9,10})$/, 'Số điện thoại không hợp lệ')
    .refine((value) => value !== '0000000000', 'Số điện thoại giữ chỗ không hợp lệ'),
})

export const AdjudicateClientCollisionSchema = LifecycleMutationBaseSchema.extend({
  relatedClientId: z.string().uuid(),
  relatedExpectedUpdatedAt: IsoDateTimeSchema,
  collisionType: ClientCollisionTypeSchema,
  disposition: ClientCollisionDispositionSchema,
}).superRefine((value, context) => {
  if (value.clientId === value.relatedClientId) {
    context.addIssue({
      code: 'custom',
      path: ['relatedClientId'],
      message: 'Khách hàng liên quan phải là một khách hàng khác',
    })
  }
  if (
    value.collisionType === 'government_identity' &&
    value.disposition !== 'correction_required'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['disposition'],
      message: 'Xung đột CCCD/CMND bắt buộc phải hiệu chỉnh thông tin',
    })
  }
})

export const ClientLifecycleMutationResultSchema = z.object({
  id: z.string().uuid(),
  status: ClientLifecycleStatusSchema,
  updatedAt: IsoDateTimeSchema,
})

export const ClientCollisionAdjudicationResultSchema = z.object({
  id: z.string().uuid(),
  relatedClientId: z.string().uuid(),
  collisionType: ClientCollisionTypeSchema,
  disposition: ClientCollisionDispositionSchema,
  adjudicatedAt: IsoDateTimeSchema,
})

export type ClientCollisionCandidate = z.infer<
  typeof ClientCollisionCandidateSchema
>
export type ClientCollisionReason = z.infer<
  typeof ClientCollisionReasonSchema
>
export type ClientCollisionType = z.infer<typeof ClientCollisionTypeSchema>
export type ClientCollisionEvidenceLevel = z.infer<
  typeof ClientCollisionEvidenceLevelSchema
>
export type ClientCollisionDisposition = z.infer<
  typeof ClientCollisionDispositionSchema
>
export type ClientLifecycleManagerRow = z.infer<
  typeof ClientLifecycleManagerRowSchema
>
export type ClientLifecycleManagerData = z.infer<
  typeof ClientLifecycleManagerDataSchema
>
export type GetClientLifecycleManager = z.infer<
  typeof GetClientLifecycleManagerSchema
>
export type GetClientLifecycleDetail = z.infer<
  typeof GetClientLifecycleDetailSchema
>
export type ClientLifecycleDetail = z.infer<typeof ClientLifecycleDetailSchema>
export type DeactivateClient = z.infer<typeof DeactivateClientSchema>
export type RestoreClient = z.infer<typeof RestoreClientSchema>
export type CorrectClientIdentity = z.infer<
  typeof CorrectClientIdentitySchema
>
export type AdjudicateClientCollision = z.infer<
  typeof AdjudicateClientCollisionSchema
>
export type ClientLifecycleMutationResult = z.infer<
  typeof ClientLifecycleMutationResultSchema
>
export type ClientCollisionAdjudicationResult = z.infer<
  typeof ClientCollisionAdjudicationResultSchema
>
