import { z } from 'zod'
import { SampleStatus, SampleType, ResultStatus, PaginationSchema, Gender } from './core'
import { UUID_REGEX } from '@/lib/utils-lims'

// ============================================================================
// LAB SPECIALTY SCHEMAS
// ============================================================================

export const LabSpecialtySchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    display_order: z.number().int(),
    description: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable(),
})

export type LabSpecialty = z.infer<typeof LabSpecialtySchema>

export const CreateLabSpecialtySchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    code: z.string().min(1, 'Code is required').max(20).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
    description: z.string().optional(),
})

export type CreateLabSpecialty = z.infer<typeof CreateLabSpecialtySchema>

// ============================================================================
// METHOD SCHEMAS
// ============================================================================

export const MethodSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().nullable(),
    procedure_reference: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable(),
})

export type Method = z.infer<typeof MethodSchema>

export const CreateMethodSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    procedure_reference: z.string().optional(),
})

export type CreateMethod = z.infer<typeof CreateMethodSchema>

// ============================================================================
// ASSAY-METHOD JUNCTION SCHEMAS
// ============================================================================

export const AssayMethodSchema = z.object({
    id: z.string().uuid(),
    assay_id: z.string().uuid(),
    method_id: z.string().uuid(),
    is_default: z.boolean(),
    notes: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type AssayMethod = z.infer<typeof AssayMethodSchema>

export const CreateAssayMethodSchema = z.object({
    assay_id: z.string().uuid(),
    method_id: z.string().uuid(),
    is_default: z.boolean().default(false),
    notes: z.string().optional(),
})

export type CreateAssayMethod = z.infer<typeof CreateAssayMethodSchema>

// ============================================================================
// ASSAY DEFINITION SCHEMAS
// ============================================================================

export const AssayDefinitionSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    specialty_id: z.string().uuid().nullable().optional(),
    units: z.string().nullable(),
    normal_range: z.string().nullable().optional(),
    validation_rules: z.record(z.string(), z.any()).default({}),
    is_confidential: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable(),
})

export type AssayDefinition = z.infer<typeof AssayDefinitionSchema>

export const CreateAssayDefinitionSchema = z.object({
    name: z.string().min(1).max(200),
    specialty_id: z.string().uuid().optional(),
    method_id: z.string().uuid().optional(),
    units: z.string().optional(),
    normal_range: z.string().nullable().optional(),
    validation_rules: z.record(z.string(), z.any()).optional(),
    is_confidential: z.boolean().optional(),
})

export type CreateAssayDefinition = z.infer<typeof CreateAssayDefinitionSchema>

export const AssayDefinitionWithMethodsSchema = AssayDefinitionSchema.extend({
    methods: z.array(z.object({
        id: z.string().uuid(),
        method_id: z.string().uuid(),
        name: z.string(),
        is_default: z.boolean(),
        notes: z.string().nullable(),
    })),
})

export type AssayDefinitionWithMethods = z.infer<typeof AssayDefinitionWithMethodsSchema>

// Deprecated: Use AssayDefinitionWithMethodsSchema instead
export const AssayWithMethodSchema = AssayDefinitionSchema.extend({
    method_name: z.string().nullable(),
})

export type AssayWithMethod = z.infer<typeof AssayWithMethodSchema>

// ============================================================================
// SAMPLE SCHEMAS
// ============================================================================

export const SampleSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().min(1).max(100),
    client_id: z.string().uuid().nullable(),
    client_name: z.string().nullable(),
    type: SampleType.nullable().optional(),
    status: SampleStatus,
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

export const CreateSampleSchema = z.object({
    sample_id: z.string().min(1).max(100).optional(),
    client_id: z.string().uuid(),
    client_name: z.string().min(1).max(200).optional(),
    type: SampleType,
    received_at: z.string().datetime().optional(),
})

export type CreateSample = z.infer<typeof CreateSampleSchema>

export const CreateSampleWithAssignmentsSchema = z.object({
    client_id: z.string().uuid(),
    client_name: z.string().min(1).max(200),
    type: SampleType,
    received_at: z.string().datetime().optional(),
    tests: z.array(z.object({
        assayId: z.string(),
        methodId: z.string(),
    })).min(1, 'At least one test must be selected'),
})

export type CreateSampleWithAssignments = z.infer<typeof CreateSampleWithAssignmentsSchema>

export const UpdateSampleSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().min(1).max(100).optional(),
    client_id: z.string().uuid().optional(),
    client_name: z.string().min(1).max(200).optional(),
    type: SampleType.optional(),
    status: SampleStatus.optional(),
})

export type UpdateSample = z.infer<typeof UpdateSampleSchema>

export const AssignTestsSchema = z.object({
    sampleId: z.string().uuid(),
    tests: z.array(z.object({
        assayId: z.string().uuid(),
        methodId: z.string().nullable(),
    })).min(1, 'At least one test must be selected'),
})

export type AssignTests = z.infer<typeof AssignTestsSchema>

export const SampleListParamsSchema = PaginationSchema.extend({
    scope: z.enum(['active', 'all']).optional(),
    status: SampleStatus.optional(),
    rejectedOnly: z.boolean().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    receiverId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional(),
    specialtyIds: z.string().optional(),
})

export type SampleListParams = z.infer<typeof SampleListParamsSchema>

export const QCEntryParamsSchema = PaginationSchema.extend({
    specialty: z.string().uuid().optional(),
    id: z.string().uuid().optional(),
    search: z.string().max(100).optional(),
    status: z.enum(['pending', 'entered', 'approved']).optional(),
}).omit({ sortBy: true, sortOrder: true })

export type QCEntryParams = z.infer<typeof QCEntryParamsSchema>

export const SampleWithUserSchema = SampleSchema.extend({
    received_by_name: z.string().nullable(),
    rejected_by_name: z.string().nullable().optional(),
})

export type SampleWithUser = z.infer<typeof SampleWithUserSchema>

export type SelectedTest = {
    assayId: string
    methodId: string
    assayName: string
    methodName: string
    units: string | null
}

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

export const ResultSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().uuid(),
    assay_id: z.string().uuid(),
    method_id: z.string().uuid().nullable(),
    value: z.string().nullable(),
    status: ResultStatus,
    entered_by: z.string().uuid().nullable(),
    entered_at: z.string().datetime().nullable(),
    approved_by: z.string().uuid().nullable(),
    approved_at: z.string().datetime().nullable(),
    approval_note: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type Result = z.infer<typeof ResultSchema>

export const CreateResultSchema = z.object({
    sample_id: z.string().uuid(),
    assay_id: z.string().uuid(),
    method_id: z.string().uuid().optional(),
    value: z.string().optional(),
})

export type CreateResult = z.infer<typeof CreateResultSchema>

export const UpdateResultSchema = z.object({
    id: z.string().uuid(),
    value: z.string(),
})

export type UpdateResult = z.infer<typeof UpdateResultSchema>

export const BatchUpdateResultsSchema = z.array(UpdateResultSchema)

export type BatchUpdateResults = z.infer<typeof BatchUpdateResultsSchema>

// ============================================================================
// VALIDATION RULES
// ============================================================================

export const ValidationRulesSchema = z.record(z.string(), z.any()).default({})

export type ValidationRules = z.infer<typeof ValidationRulesSchema>

// ============================================================================
// BATCH RESULT OPERATIONS
// ============================================================================

export const BatchResultInputSchema = z.object({
    id: z.string().uuid(),
    value: z.string().min(1, 'Value is required'),
})

export type BatchResultInput = z.infer<typeof BatchResultInputSchema>

export const SaveBatchResultsSchema = z.object({
    results: z.array(BatchResultInputSchema).min(1, 'At least one result must be provided'),
})

export type SaveBatchResults = z.infer<typeof SaveBatchResultsSchema>

// ============================================================================
// RESULT WITH ASSAY DETAILS
// ============================================================================

export const ResultWithAssaySchema = ResultSchema.extend({
    assay_name: z.string(),
    assay_units: z.string().nullable(),
    method_name: z.string().nullable(),
    validation_rules: ValidationRulesSchema,
    sample_id_display: z.string(),
    sample_status: SampleStatus.nullable(),
    entered_by_name: z.string().nullable(),
    lab_specialty_name: z.string().nullable().optional(),
    lab_specialty_order: z.number().int().optional(),
})

export type ResultWithAssay = z.infer<typeof ResultWithAssaySchema>

// ============================================================================
// VALIDATION ERROR
// ============================================================================

export const ValidationErrorSchema = z.object({
    field: z.string(),
    message: z.string(),
    rule: z.string().optional(),
})

export type ValidationError = z.infer<typeof ValidationErrorSchema>

// ============================================================================
// SAMPLE DATA FOR COA (re-exported, defined here for lab context)
// ============================================================================

export const SampleDataSchema = z.object({
    id: z.string().uuid(),
    sample_id_display: z.string(),
    approved_by: z.string().uuid().nullable(),
    approved_at: z.string().nullable(),
    client_name: z.string().optional(),
    sample_type: z.string().optional(),
    received_date: z.string().optional(),
    client_dob: z.string().nullable().optional(),
    client_gender: Gender.nullable().optional(),
    client_address: z.string().nullable().optional(),
    client_health_insurance_num: z.string().nullable().optional(),
})

export type SampleData = z.infer<typeof SampleDataSchema>

// ============================================================================
// QC ENTRY TYPES
// ============================================================================

/**
 * Specialty with QC definition count for filter display
 */
export interface SpecialtyWithQC {
    id: string
    name: string
    qc_count: number
}
