import { z } from 'zod'

// ============================================================================
// ENUMS
// ============================================================================

export const UserRole = z.enum(['analyst', 'manager'])
export type UserRole = z.infer<typeof UserRole>

export const SampleStatus = z.enum(['received', 'assigned', 'in_progress', 'review', 'completed'])
export type SampleStatus = z.infer<typeof SampleStatus>

export const ResultStatus = z.enum(['pending', 'entered', 'approved'])
export type ResultStatus = z.infer<typeof ResultStatus>

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UserSchema = z.object({
    id: z.string().uuid(),
    username: z.string().min(3).max(50),
    full_name: z.string().min(1).max(100),
    role: UserRole,
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type User = z.infer<typeof UserSchema>

export const CreateUserSchema = z.object({
    username: z.string().min(3).max(50),
    full_name: z.string().min(1).max(100),
    password: z.string().min(8),
    role: UserRole,
})

export type CreateUser = z.infer<typeof CreateUserSchema>

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
// ASSAY DEFINITION SCHEMAS
// ============================================================================

export const AssayDefinitionSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    method_id: z.string().uuid().nullable(),
    units: z.string().nullable(),
    validation_rules: z.record(z.string(), z.any()).default({}),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable(),
})

export type AssayDefinition = z.infer<typeof AssayDefinitionSchema>

export const CreateAssayDefinitionSchema = z.object({
    name: z.string().min(1).max(200),
    method_id: z.string().uuid().optional(),
    units: z.string().optional(),
    validation_rules: z.record(z.string(), z.any()).optional(),
})

export type CreateAssayDefinition = z.infer<typeof CreateAssayDefinitionSchema>

// ============================================================================
// SAMPLE SCHEMAS
// ============================================================================

export const SampleSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().min(1).max(100),
    client_id: z.string().uuid().nullable(),
    client_name: z.string().nullable(),
    status: SampleStatus,
    received_at: z.string().datetime(),
    received_by: z.string().uuid().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable(),
})

export type Sample = z.infer<typeof SampleSchema>

export const CreateSampleSchema = z.object({
    sample_id: z.string().min(1).max(100),
    client_id: z.string().uuid().optional(),
    client_name: z.string().min(1).max(200).optional(),
    received_at: z.string().datetime().optional(),
})

export type CreateSample = z.infer<typeof CreateSampleSchema>

export const UpdateSampleSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().min(1).max(100).optional(),
    client_name: z.string().min(1).max(200).optional(),
    status: SampleStatus.optional(),
})

export type UpdateSample = z.infer<typeof UpdateSampleSchema>

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
// AUDIT LOG SCHEMAS
// ============================================================================

export const AuditLogSchema = z.object({
    id: z.string().uuid(),
    table_name: z.string(),
    record_id: z.string().uuid(),
    operation: z.string(),
    old_values: z.record(z.string(), z.any()).nullable(),
    new_values: z.record(z.string(), z.any()).nullable(),
    changed_by: z.string().uuid().nullable(),
    changed_at: z.string().datetime(),
})

export type AuditLog = z.infer<typeof AuditLogSchema>

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type Pagination = z.infer<typeof PaginationSchema>

// ============================================================================
// LOGIN SCHEMA
// ============================================================================

export const LoginSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(8),
})

export type Login = z.infer<typeof LoginSchema>

// ============================================================================
// SAMPLE EXTENDED SCHEMAS (Phase 2)
// ============================================================================

export const AssignTestsSchema = z.object({
    sampleId: z.string().uuid(),
    assayIds: z.array(z.string().uuid()).min(1, 'At least one test must be selected'),
})

export type AssignTests = z.infer<typeof AssignTestsSchema>

export const SampleListParamsSchema = PaginationSchema.extend({
    status: SampleStatus.optional(),
})

export type SampleListParams = z.infer<typeof SampleListParamsSchema>

export const SampleWithUserSchema = SampleSchema.extend({
    received_by_name: z.string().nullable(),
})

export type SampleWithUser = z.infer<typeof SampleWithUserSchema>

// ============================================================================
// ASSAY WITH METHOD SCHEMA
// ============================================================================

export const AssayWithMethodSchema = AssayDefinitionSchema.extend({
    method_name: z.string().nullable(),
})

export type AssayWithMethod = z.infer<typeof AssayWithMethodSchema>
