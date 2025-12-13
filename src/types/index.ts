import { z } from 'zod'

// ============================================================================
// ENUMS
// ============================================================================

export const UserRole = z.enum(['analyst', 'manager'])
export type UserRole = z.infer<typeof UserRole>

export const SampleStatus = z.enum(['received', 'assigned', 'in_progress', 'review', 'discarded', 'completed'])
export type SampleStatus = z.infer<typeof SampleStatus>

export const ResultStatus = z.enum(['pending', 'entered', 'approved'])
export type ResultStatus = z.infer<typeof ResultStatus>

export const Gender = z.enum(['Nam', 'Nữ', 'Khác'])
export type Gender = z.infer<typeof Gender>

export const SampleType = z.enum([
    'Máu',
    'Dịch niệu đạo/âm đạo',
    'Nước tiểu',
    'Phết tế bào âm đạo',
    'Ngoáy trực tràng/hậu môn',
    'Phân',
    'Nước',
    'Thực phẩm'
])
export type SampleType = z.infer<typeof SampleType>

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const UserSchema = z.object({
    id: z.string().uuid(),
    username: z.string().min(3).max(50),
    full_name: z.string().min(1).max(100),
    role: UserRole,
    email: z.string().email().nullable().optional(),
    lab: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type User = z.infer<typeof UserSchema>

export const CreateUserSchema = z.object({
    username: z.string().min(3).max(50),
    full_name: z.string().min(1).max(100),
    email: z.string().email().optional(),
    lab: z.string().optional(),
    password: z.string().min(8),
    role: UserRole,
})

export type CreateUser = z.infer<typeof CreateUserSchema>

export const UpdateUserSchema = z.object({
    id: z.string().uuid(),
    full_name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    lab: z.string().optional(),
    role: UserRole.optional(),
    password: z.string().min(8).optional(),
})

export type UpdateUser = z.infer<typeof UpdateUserSchema>

// ============================================================================
// CLIENT SCHEMAS
// ============================================================================

export const ClientSchema = z.object({
    id: z.string().uuid(),
    id_card_num: z.string(),
    name: z.string(),
    date_of_birth: z.string(),
    gender: Gender,
    phone: z.string(),
    address: z.string().nullable().optional(),
    health_insurance_num: z.string().nullable().optional(),
    expiry_date: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type Client = z.infer<typeof ClientSchema>

export const CreateClientSchema = z.object({
    id_card_num: z.string().min(1, 'Số CMND/CCCD là bắt buộc'),
    name: z.string().min(1, 'Tên là bắt buộc'),
    date_of_birth: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Ngày sinh không hợp lệ'
    }),
    gender: Gender,
    phone: z.string().regex(/^(0|\+84)[0-9]{9,10}$/, 'Số điện thoại không hợp lệ'),
    address: z.string().optional(),
    health_insurance_num: z.string().optional(),
    expiry_date: z.string().optional(),
})

export type CreateClient = z.infer<typeof CreateClientSchema>

export const UpdateClientSchema = z.object({
    id: z.string().uuid(),
    id_card_num: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    date_of_birth: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Ngày sinh không hợp lệ'
    }).optional(),
    gender: Gender.optional(),
    phone: z.string().regex(/^(0|\+84)[0-9]{9,10}$/, 'Số điện thoại không hợp lệ').optional(),
    address: z.string().optional(),
    health_insurance_num: z.string().optional(),
    expiry_date: z.string().optional(),
})

export type UpdateClient = z.infer<typeof UpdateClientSchema>

// ============================================================================
// METHOD SCHEMAS
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
    validation_rules: z.record(z.string(), z.any()).default({}),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable(),
})

export type AssayDefinition = z.infer<typeof AssayDefinitionSchema>

export const CreateAssayDefinitionSchema = z.object({
    name: z.string().min(1).max(200),
    specialty_id: z.string().uuid().optional(),
    method_id: z.string().uuid().optional(), // Initial method for creation
    units: z.string().optional(),
    validation_rules: z.record(z.string(), z.any()).optional(),
})

export type CreateAssayDefinition = z.infer<typeof CreateAssayDefinitionSchema>

// Extended assay definition with methods array
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
        assayId: z.string(), // Relaxed from .uuid() to support legacy/test IDs
        methodId: z.string(), // Relaxed from .uuid() to support legacy/test data
    })).min(1, 'At least one test must be selected'),
})

export type CreateSampleWithAssignments = z.infer<typeof CreateSampleWithAssignmentsSchema>

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
    tests: z.array(z.object({
        assayId: z.string().uuid(),
        methodId: z.string(), // Relaxed from .uuid() to allow test data with non-standard UUIDs
    })).min(1, 'At least one test must be selected'),
})

export type AssignTests = z.infer<typeof AssignTestsSchema>


export const SampleListParamsSchema = PaginationSchema.extend({
    status: SampleStatus.optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    receiverId: z.string().uuid().optional(),
})

export type SampleListParams = z.infer<typeof SampleListParamsSchema>

export const SampleWithUserSchema = SampleSchema.extend({
    received_by_name: z.string().nullable(),
    rejected_by_name: z.string().nullable().optional(),
})

export type SampleWithUser = z.infer<typeof SampleWithUserSchema>

// ============================================================================
// ASSAY WITH METHOD SCHEMA
// ============================================================================

// Deprecated: Use AssayDefinitionWithMethodsSchema instead
// Kept for backward compatibility during migration
export const AssayWithMethodSchema = AssayDefinitionSchema.extend({
    method_name: z.string().nullable(),
})

export type AssayWithMethod = z.infer<typeof AssayWithMethodSchema>

// ============================================================================
// VALIDATION RULES (Phase 3)
// ============================================================================

export const ValidationRulesSchema = z.record(z.string(), z.any()).default({})

export type ValidationRules = z.infer<typeof ValidationRulesSchema>

// ============================================================================
// BATCH RESULT OPERATIONS (Phase 3)
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
// RESULT WITH ASSAY DETAILS (Phase 3)
// ============================================================================

export const ResultWithAssaySchema = ResultSchema.extend({
    assay_name: z.string(),
    assay_units: z.string().nullable(),
    method_name: z.string().nullable(),
    validation_rules: ValidationRulesSchema,
    sample_id_display: z.string(),
    sample_status: SampleStatus.nullable(),
    entered_by_name: z.string().nullable(),
})

export type ResultWithAssay = z.infer<typeof ResultWithAssaySchema>

// ============================================================================
// VALIDATION ERROR (Phase 3)
// ============================================================================

export const ValidationErrorSchema = z.object({
    field: z.string(),
    message: z.string(),
    rule: z.string().optional(),
})

export type ValidationError = z.infer<typeof ValidationErrorSchema>

// ============================================================================
// APPROVAL ACTIONS (Phase 4)
// ============================================================================

export const ApproveResultsSchema = z.object({
    sampleId: z.string().uuid(),
    resultIds: z.array(z.string().uuid()).min(1, 'At least one result must be selected'),
    note: z.string().max(500).optional(),
})

export type ApproveResults = z.infer<typeof ApproveResultsSchema>

export const CancelApprovalSchema = z.object({
    sampleId: z.string().uuid(),
    resultIds: z.array(z.string().uuid()).min(1, 'At least one result must be selected'),
    reason: z.string().min(3, 'Reason is required (min 3 characters)').max(500),
})

export type CancelApproval = z.infer<typeof CancelApprovalSchema>

export const RejectSampleSchema = z.object({
    sampleId: z.string().uuid(),
    reason: z.string().min(1, 'Lý do từ chối là bắt buộc'),
})

export type RejectSample = z.infer<typeof RejectSampleSchema>

export const DiscardSampleSchema = z.object({
    sampleId: z.string().uuid(),
    reason: z.string().min(1, 'Lý do loại bỏ là bắt buộc'),
})

export type DiscardSample = z.infer<typeof DiscardSampleSchema>
