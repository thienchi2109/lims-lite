import { z } from 'zod'

const UuidSchema = z.string().uuid()
const RevisionTokenSchema = z.string().datetime({ offset: true })
const RequiredReasonSchema = z.string().trim().min(1).max(1000)

export const AssaySampleTypeReviewDispositionSchema = z.enum([
  'configured',
  'not_assignable',
])

export const AssaySampleTypeCandidateDecisionValueSchema = z.enum([
  'accepted',
  'rejected',
])

export const AssaySampleTypeCandidateDecisionSchema = z.object({
  candidateId: UuidSchema,
  decision: AssaySampleTypeCandidateDecisionValueSchema,
  reason: RequiredReasonSchema,
}).strict()

export const CloneAssaySampleTypeCatalogRevisionSchema = z.object({
  sourceRevisionNumber: z.number().int().positive(),
  creationReason: RequiredReasonSchema,
}).strict()

export const UpdateAssaySampleTypeCatalogReviewSchema = z.object({
  revisionId: UuidSchema,
  assayDefinitionId: UuidSchema,
  disposition: AssaySampleTypeReviewDispositionSchema,
  reviewReason: RequiredReasonSchema,
  sampleTypeIds: z.array(UuidSchema),
  candidateDecisions: z.array(AssaySampleTypeCandidateDecisionSchema),
  expectedRevisionUpdatedAt: RevisionTokenSchema,
}).strict().superRefine((value, context) => {
  if (new Set(value.sampleTypeIds).size !== value.sampleTypeIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sampleTypeIds'],
      message: 'Loại mẫu không được trùng lặp',
    })
  }

  const candidateIds = value.candidateDecisions.map(
    (decision) => decision.candidateId,
  )
  if (new Set(candidateIds).size !== candidateIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['candidateDecisions'],
      message: 'Quyết định candidate không được trùng lặp',
    })
  }

  if (value.disposition === 'configured' && value.sampleTypeIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sampleTypeIds'],
      message: 'Chỉ tiêu configured phải có ít nhất một loại mẫu',
    })
  }

  if (
    value.disposition === 'not_assignable'
    && value.sampleTypeIds.length !== 0
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sampleTypeIds'],
      message: 'Chỉ tiêu không thể chỉ định không được có loại mẫu',
    })
  }
})

export const ReviewAssaySampleTypeCatalogRevisionSchema = z.object({
  revisionId: UuidSchema,
  expectedRevisionUpdatedAt: RevisionTokenSchema,
}).strict()

export const PublishAssaySampleTypeCatalogRevisionSchema = z.object({
  revisionId: UuidSchema,
  expectedRevisionUpdatedAt: RevisionTokenSchema,
  publishReason: RequiredReasonSchema,
}).strict()

export const GetAssaySampleTypeCatalogManagerSchema = z.object({
  revisionId: UuidSchema.optional(),
}).strict()

export const GetPublishedAssaySampleTypeCatalogSchema = z.object({
  sampleTypeId: UuidSchema.optional(),
}).strict()

const CatalogRevisionSchema = z.object({
  id: UuidSchema,
  revisionNumber: z.number().int().positive(),
  status: z.enum(['draft', 'published', 'superseded']),
  sourceRevisionId: UuidSchema.nullable(),
  sourceRevisionNumber: z.number().int().positive().nullable(),
  creationReason: z.string(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  publishReason: z.string().nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  updatedAt: RevisionTokenSchema,
}).strict()

const CatalogSampleTypeSchema = z.object({
  id: UuidSchema,
  importCode: z.string(),
  name: z.string(),
  compatibilityGeneration: z.number().int().positive(),
  isActive: z.boolean(),
}).strict()

const CatalogCandidateSchema = z.object({
  id: UuidSchema,
  sampleTypeId: UuidSchema,
  observationCount: z.number().int().positive(),
  firstObservedAt: z.string().datetime({ offset: true }),
  lastObservedAt: z.string().datetime({ offset: true }),
  decision: AssaySampleTypeCandidateDecisionValueSchema.nullable(),
  decisionReason: z.string().nullable(),
}).strict()

const CatalogCompatibilitySchema = z.object({
  sampleTypeId: UuidSchema,
  provenance: z.enum(['manual', 'historical_candidate']),
  sourceCandidateId: UuidSchema.nullable(),
}).strict()

const CatalogAssaySchema = z.object({
  assayDefinitionId: UuidSchema,
  importCode: z.string(),
  name: z.string(),
  methodName: z.string().nullable(),
  specialtyId: UuidSchema.nullable(),
  compatibilityGeneration: z.number().int().positive(),
  isActive: z.boolean(),
  isStale: z.boolean(),
  reviewCompatibilityGeneration: z.number().int().positive().nullable(),
  disposition: AssaySampleTypeReviewDispositionSchema.nullable(),
  reviewReason: z.string().nullable(),
  compatibilities: z.array(CatalogCompatibilitySchema),
  candidates: z.array(CatalogCandidateSchema),
}).strict()

export const AssaySampleTypeCatalogManagerSchema = z.object({
  revision: CatalogRevisionSchema.nullable(),
  diff: z.object({
    addedPairCount: z.number().int().nonnegative(),
    removedPairCount: z.number().int().nonnegative(),
    changedReviewCount: z.number().int().nonnegative(),
  }).strict(),
  sampleTypes: z.array(CatalogSampleTypeSchema),
  assays: z.array(CatalogAssaySchema),
}).strict()

const PublishedCatalogAssaySchema = z.object({
  sampleTypeId: UuidSchema,
  assayDefinitionId: UuidSchema,
  importCode: z.string(),
  name: z.string(),
  methodName: z.string().nullable(),
  specialtyId: UuidSchema.nullable(),
}).strict()

export const PublishedAssaySampleTypeCatalogSchema = z.object({
  revisionNumber: z.number().int().positive().nullable(),
  sampleTypeId: UuidSchema.nullable(),
  assays: z.array(PublishedCatalogAssaySchema),
}).strict()

export type CloneAssaySampleTypeCatalogRevision = z.infer<
  typeof CloneAssaySampleTypeCatalogRevisionSchema
>
export type UpdateAssaySampleTypeCatalogReview = z.infer<
  typeof UpdateAssaySampleTypeCatalogReviewSchema
>
export type ReviewAssaySampleTypeCatalogRevision = z.infer<
  typeof ReviewAssaySampleTypeCatalogRevisionSchema
>
export type PublishAssaySampleTypeCatalogRevision = z.infer<
  typeof PublishAssaySampleTypeCatalogRevisionSchema
>
export type GetAssaySampleTypeCatalogManager = z.infer<
  typeof GetAssaySampleTypeCatalogManagerSchema
>
export type GetPublishedAssaySampleTypeCatalog = z.infer<
  typeof GetPublishedAssaySampleTypeCatalogSchema
>
export type AssaySampleTypeCatalogManager = z.infer<
  typeof AssaySampleTypeCatalogManagerSchema
>
export type PublishedAssaySampleTypeCatalog = z.infer<
  typeof PublishedAssaySampleTypeCatalogSchema
>
