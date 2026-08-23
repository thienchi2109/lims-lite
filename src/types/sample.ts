/**
 * Sample domain schemas for persisted records, accession inputs, updates,
 * assignments, and list filters.
 */

import { z } from 'zod'
import { PaginationSchema, SampleStatus, SampleType } from './core'
import { UUID_REGEX } from '@/lib/utils-lims'
import { AccessionClientResolutionSchema } from './client-resolution'

const SampleTypeSelectionSchema = z.object({
    sampleTypeId: z.string().uuid(),
    sampleTypeCode: z.string().regex(/^LM-[0-9]{6}$/),
    expectedRevisionNumber: z.number().int().positive(),
})

const OptionalSampleTypeSelectionSchema = z.object({
    sampleTypeId: z.string().uuid().optional(),
    sampleTypeCode: z.string().regex(/^LM-[0-9]{6}$/).optional(),
    expectedRevisionNumber: z.number().int().positive().optional(),
})

export const SampleSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().min(1).max(100),
    client_id: z.string().uuid().nullable(),
    client_name: z.string().nullable(),
    sample_type_id: z.string().uuid().nullable().optional(),
    type: SampleType.nullable().optional(),
    status: SampleStatus,
    sample_quality: z.boolean().nullable(),
    received_at: z.string().datetime(),
    received_by: z.string().uuid().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable(),
    rejection_reason: z.string().nullable().optional(),
    rejected_at: z.string().datetime().nullable().optional(),
    rejected_by: z.string().uuid().nullable().optional(),
})

export type Sample = z.infer<typeof SampleSchema>

const CreateSampleBaseSchema = z.object({
    sample_id: z.string().min(1).max(100).optional(),
    client_id: z.string().uuid(),
    client_name: z.string().min(1).max(200).optional(),
    type: SampleType,
    sample_quality: z.boolean(),
    received_at: z.string().datetime().optional(),
})

export const CreateSampleSchema = CreateSampleBaseSchema.merge(OptionalSampleTypeSelectionSchema)
export const CreateSampleV2Schema = CreateSampleBaseSchema.merge(SampleTypeSelectionSchema)
export const CreateSampleWithClientResolutionSchema =
    CreateSampleV2Schema.extend({
        client_id: z.string().uuid().optional(),
        client_resolution: AccessionClientResolutionSchema,
    })

export type CreateSample = z.infer<typeof CreateSampleSchema>
export type CreateSampleWithClientResolution = z.infer<
    typeof CreateSampleWithClientResolutionSchema
>

const CreateSampleWithAssignmentsBaseSchema = z.object({
    client_id: z.string().uuid(),
    client_name: z.string().min(1).max(200),
    type: SampleType,
    sample_quality: z.boolean(),
    received_at: z.string().datetime().optional(),
    tests: z.array(z.object({
        assayId: z.string(),
        methodId: z.string().nullable(),
    })).min(1, 'At least one test must be selected'),
})

export const CreateSampleWithAssignmentsSchema =
    CreateSampleWithAssignmentsBaseSchema.merge(OptionalSampleTypeSelectionSchema)
export const CreateSampleWithAssignmentsV2Schema =
    CreateSampleWithAssignmentsBaseSchema.merge(SampleTypeSelectionSchema)
export const CreateSampleWithAssignmentsAndClientResolutionSchema =
    CreateSampleWithAssignmentsV2Schema.extend({
        client_id: z.string().uuid().optional(),
        client_name: z.string().min(1).max(200).optional(),
        client_resolution: AccessionClientResolutionSchema,
    })

export type CreateSampleWithAssignments = z.infer<typeof CreateSampleWithAssignmentsSchema>
export type CreateSampleWithAssignmentsAndClientResolution = z.infer<
    typeof CreateSampleWithAssignmentsAndClientResolutionSchema
>

export const UpdateSampleSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().min(1).max(100).optional(),
    client_id: z.string().uuid().optional(),
    client_name: z.string().min(1).max(200).optional(),
    type: SampleType.optional(),
    status: SampleStatus.optional(),
})

export type UpdateSample = z.infer<typeof UpdateSampleSchema>

const AssignTestsBaseSchema = z.object({
    sampleId: z.string().uuid(),
    tests: z.array(z.object({
        assayId: z.string().uuid(),
        methodId: z.string().nullable(),
    })).min(1, 'At least one test must be selected'),
})

export const AssignTestsSchema = AssignTestsBaseSchema.merge(OptionalSampleTypeSelectionSchema)
export const AssignTestsV2Schema = AssignTestsBaseSchema.merge(SampleTypeSelectionSchema)

export type AssignTests = z.infer<typeof AssignTestsSchema>

export const SampleListParamsSchema = PaginationSchema.extend({
    scope: z.enum(['active', 'all']).optional(),
    status: SampleStatus.optional(),
    rejectedOnly: z.boolean().optional(),
    confidentialOnly: z.boolean().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    receiverId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional(),
    specialtyIds: z.string().optional(),
})

export type SampleListParams = z.infer<typeof SampleListParamsSchema>

export const SampleWithUserSchema = SampleSchema.extend({
    received_by_name: z.string().nullable(),
    rejected_by_name: z.string().nullable().optional(),
})

export type SampleWithUser = z.infer<typeof SampleWithUserSchema>
