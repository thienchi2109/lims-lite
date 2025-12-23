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
    // Signature status (from left join with user_signatures)
    user_signatures: z.array(z.object({
        id: z.string().uuid(),
        is_active: z.boolean(),
        uploaded_at: z.string().datetime(),
    })).optional(),
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
    id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID format'),
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
    client_id: z.string().uuid().optional(),
    client_name: z.string().min(1).max(200).optional(),
    type: SampleType.optional(),
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
// PROFILE SCHEMAS
// ============================================================================

export const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Mật khẩu hiện tại là bắt buộc'),
    password: z.string().min(1, 'Mật khẩu không được để trống'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
})

export type ChangePassword = z.infer<typeof ChangePasswordSchema>

// ============================================================================
// SAMPLE EXTENDED SCHEMAS (Phase 2)
// ============================================================================

export const AssignTestsSchema = z.object({
    sampleId: z.string().uuid(),
    tests: z.array(z.object({
        assayId: z.string().uuid(),
        methodId: z.string().nullable(), // Allow null for method-less test assignments
    })).min(1, 'At least one test must be selected'),
})

export type AssignTests = z.infer<typeof AssignTestsSchema>


export const SampleListParamsSchema = PaginationSchema.extend({
    status: SampleStatus.optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    receiverId: z.string().uuid().optional(),
    specialtyIds: z.string().optional(), // Comma-separated UUIDs for lab specialty filter
})

export type SampleListParams = z.infer<typeof SampleListParamsSchema>

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
    lab_specialty_name: z.string().nullable().optional(),
    lab_specialty_order: z.number().int().optional(),
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

// ============================================================================
// USER SIGNATURE SCHEMAS (Phase 3.5)
// ============================================================================

export const UserSignatureSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    signature_path: z.string(),
    signature_hash: z.string(),
    file_size: z.number().int(),
    mime_type: z.enum(['image/png', 'image/jpeg']),
    uploaded_at: z.string().datetime(),
    is_active: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type UserSignature = z.infer<typeof UserSignatureSchema>

// Signature validation constants
export const SIGNATURE_VALIDATION = {
    maxFileSize: 500 * 1024,  // 500KB
    allowedMimeTypes: ['image/png', 'image/jpeg'] as const,
    minWidth: 200,  // pixels
    minHeight: 80,   // pixels
    maxWidth: 800,
    maxHeight: 400,
} as const

// Client-side file validation schema (before upload)
export const SignatureFileValidationSchema = z.object({
    size: z.number()
        .max(SIGNATURE_VALIDATION.maxFileSize, 'Kích thước file tối đa 500KB'),
    type: z.enum(['image/png', 'image/jpeg'], {
        message: 'Chỉ chấp nhận file PNG hoặc JPEG'
    }),
})

export type SignatureFileValidation = z.infer<typeof SignatureFileValidationSchema>

// Server-side upload validation schema
export const UploadSignatureSchema = z.object({
    file: z.instanceof(File)
        .refine(f => f.size <= SIGNATURE_VALIDATION.maxFileSize, 'Kích thước file tối đa 500KB')
        .refine(f => SIGNATURE_VALIDATION.allowedMimeTypes.includes(f.type as any), 'Chỉ chấp nhận file PNG hoặc JPEG'),
    width: z.number()
        .min(SIGNATURE_VALIDATION.minWidth, `Chiều rộng tối thiểu ${SIGNATURE_VALIDATION.minWidth}px`)
        .max(SIGNATURE_VALIDATION.maxWidth, `Chiều rộng tối đa ${SIGNATURE_VALIDATION.maxWidth}px`),
    height: z.number()
        .min(SIGNATURE_VALIDATION.minHeight, `Chiều cao tối thiểu ${SIGNATURE_VALIDATION.minHeight}px`)
        .max(SIGNATURE_VALIDATION.maxHeight, `Chiều cao tối đa ${SIGNATURE_VALIDATION.maxHeight}px`),
})

export type UploadSignature = z.infer<typeof UploadSignatureSchema>

// Server action response types
export const ActiveSignatureSchema = z.object({
    id: z.string().uuid(),
    signature_path: z.string(),
    signature_hash: z.string(),
    mime_type: z.enum(['image/png', 'image/jpeg']),
    uploaded_at: z.coerce.date(), // Coerce PostgreSQL timestamptz to Date object
})

export type ActiveSignature = z.infer<typeof ActiveSignatureSchema>

export const SignatureHistoryItemSchema = z.object({
    id: z.string().uuid(),
    uploaded_at: z.coerce.date(), // Coerce PostgreSQL timestamptz to Date object
    is_active: z.boolean(),
    file_size: z.number().int(),
    mime_type: z.enum(['image/png', 'image/jpeg']),
})

export type SignatureHistoryItem = z.infer<typeof SignatureHistoryItemSchema>

// ============================================================================
// COA AUTHENTICATION SCHEMAS (Phase 5)
// ============================================================================

// Phone-only authentication request (simplified)
export const CoAAuthRequestSchema = z.object({
    phone: z.string()
        .min(10, 'Số điện thoại không hợp lệ')
        .max(15, 'Số điện thoại không hợp lệ'),
})

export type CoAAuthRequest = z.infer<typeof CoAAuthRequestSchema>

// Sample info returned after successful authentication
export const CoASampleInfoSchema = z.object({
    id: z.string().uuid(),
    sample_id_display: z.string(),
    sample_type: z.string().nullable(),
    received_date: z.string().nullable(),
    approved_at: z.string().nullable(),
    has_coa: z.boolean(),
})

export type CoASampleInfo = z.infer<typeof CoASampleInfoSchema>

// Authentication response
export const CoAAuthResponseSchema = z.object({
    success: z.boolean(),
    client_id: z.string().uuid().optional(),
    client_name: z.string().optional(),
    samples: z.array(CoASampleInfoSchema).optional(),
    token: z.string().optional(), // JWT token for downloads
    error: z.string().optional(),
})

export type CoAAuthResponse = z.infer<typeof CoAAuthResponseSchema>

// Download token payload (JWT)
export const CoADownloadTokenSchema = z.object({
    client_id: z.string().uuid(),
    sample_id: z.string().uuid().optional(), // Optional: if omitted, can download any client sample
    exp: z.number(), // Expiry timestamp
})

export type CoADownloadToken = z.infer<typeof CoADownloadTokenSchema>

// Download request
export const CoADownloadRequestSchema = z.object({
    sample_id: z.string().uuid(),
    token: z.string(),
})

export type CoADownloadRequest = z.infer<typeof CoADownloadRequestSchema>

// ============================================================================
// COA MANAGEMENT SCHEMAS (Manager Features)
// ============================================================================

export const CoAReportStatusSchema = z.enum(['pending', 'ready', 'failed'])
export type CoAReportStatus = z.infer<typeof CoAReportStatusSchema>

export const CoAReportSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().uuid(),
    file_path: z.string(),
    file_hash: z.string(),
    version: z.number().int().default(1),
    status: CoAReportStatusSchema,
    superseded_by: z.string().uuid().nullable().optional(),
    error_message: z.string().nullable().optional(),
    signature_id: z.string().uuid().nullable().optional(),
    generated_at: z.string().datetime(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type CoAReport = z.infer<typeof CoAReportSchema>

export const CoAAccessLogSchema = z.object({
    id: z.string().uuid(),
    client_id: z.string().uuid().nullable().optional(),
    sample_id: z.string().uuid().nullable().optional(),
    coa_report_id: z.string().uuid().nullable().optional(),
    accessed_at: z.string().datetime(),
    ip_address: z.string().nullable().optional(),
    user_agent: z.string().nullable().optional(),
    success: z.boolean(),
    failure_reason: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type CoAAccessLog = z.infer<typeof CoAAccessLogSchema>

// CoA Access Log with client name (for display)
export const CoAAccessLogWithClientSchema = CoAAccessLogSchema.extend({
    client_name: z.string(),
    sample_id_display: z.string(),
})

export type CoAAccessLogWithClient = z.infer<typeof CoAAccessLogWithClientSchema>

// ============================================================================
// COA MANUAL INPUTS (Phase: CoA Template Enrichment)
// ============================================================================

// Manual inputs required for CoA generation
export const CoAManualInputsSchema = z.object({
    referrer: z.string()
        .min(1, 'Bác sĩ chỉ định là bắt buộc')
        .max(200, 'Tên bác sĩ chỉ định tối đa 200 ký tự'),
    sampleQuality: z.enum(['Tốt', 'Đạt', 'Không đạt'], {
        message: 'Chất lượng mẫu không hợp lệ'
    }),
})

export type CoAManualInputs = z.infer<typeof CoAManualInputsSchema>

// Extended SampleData interface with client demographic fields (for CoA rendering)
export const SampleDataSchema = z.object({
    id: z.string().uuid(),
    sample_id_display: z.string(),
    approved_by: z.string().uuid().nullable(),
    approved_at: z.string().nullable(),
    client_name: z.string().optional(),
    sample_type: z.string().optional(),
    received_date: z.string().optional(),
    // Client demographic fields for CoA
    client_dob: z.string().nullable().optional(),
    client_gender: Gender.nullable().optional(),
    client_address: z.string().nullable().optional(),
    client_health_insurance_num: z.string().nullable().optional(),
})

export type SampleData = z.infer<typeof SampleDataSchema>

// Extended CoAData interface with testing date and manual inputs
export const CoADataSchema = z.object({
    sample: SampleDataSchema,
    results: z.array(z.object({
        assay_name: z.string(),
        value: z.string().nullable(),
        unit: z.string().nullable(),
        normal_range: z.string().nullable(),
        method_name: z.string().nullable(),
        lab_specialty_name: z.string().nullable(),
    })),
    approverName: z.string(),
    approverSignature: z.string().nullable(),
    signatureId: z.string().uuid().nullable(),
    approvalDate: z.string(),
    testingDate: z.string().nullable().optional(), // Date sample first moved to in_progress
    manualInputs: CoAManualInputsSchema.optional(), // Referrer and sample quality
})

export type CoAData = z.infer<typeof CoADataSchema>

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

// Search query validation (min 2 chars, max 200 chars)
export const SearchQuerySchema = z.object({
    query: z.string()
        .trim()
        .min(2, 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự')
        .max(200, 'Từ khóa tìm kiếm tối đa 200 ký tự'),
    maxResults: z.number().int().min(1).max(100).optional().default(20),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>

// Search result for samples
export const SearchSampleResultSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string(),
    client_name: z.string(),
    type: z.string(),
    status: SampleStatus,
    received_at: z.string().datetime(),
    rank: z.number(),
})

export type SearchSampleResult = z.infer<typeof SearchSampleResultSchema>

// Search result for clients
export const SearchClientResultSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: z.string(),
    address: z.string().nullable(),
    rank: z.number(),
})

export type SearchClientResult = z.infer<typeof SearchClientResultSchema>

// Search result for assays
export const SearchAssayResultSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    units: z.string().nullable(),
    rank: z.number(),
})

export type SearchAssayResult = z.infer<typeof SearchAssayResultSchema>

// Search result for results
export const SearchResultResultSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().uuid(),
    assay_id: z.string().uuid(),
    value: z.string().nullable(),
    status: ResultStatus,
    rank: z.number(),
})

export type SearchResultResult = z.infer<typeof SearchResultResultSchema>

// Search result for audit logs (manager only)
export const SearchAuditLogResultSchema = z.object({
    id: z.string().uuid(),
    operation: z.string(),
    table_name: z.string(),
    changed_at: z.string().datetime(),
    rank: z.number(),
})

export type SearchAuditLogResult = z.infer<typeof SearchAuditLogResultSchema>

// Global search result (combined from all entities)
export const GlobalSearchResultSchema = z.object({
    entity_type: z.enum(['sample', 'client', 'assay', 'result']),
    entity_id: z.string().uuid(),
    description: z.string(),
    rank: z.number(),
})

export type GlobalSearchResult = z.infer<typeof GlobalSearchResultSchema>

// ============================================================================
// REPORTS DASHBOARD SCHEMAS (Phase 2)
// ============================================================================

// Date range for filtering reports
export const DateRangeSchema = z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
})

export type DateRange = z.infer<typeof DateRangeSchema>

// KPI Metrics for dashboard cards
export const KPIMetricsSchema = z.object({
    avgTAT: z.object({
        value: z.number(),
        unit: z.enum(['hours', 'days']),
        trend: z.number(), // Percentage change vs previous period
        previousValue: z.number(),
    }),
    wipCount: z.object({
        value: z.number(),
        breakdown: z.array(z.object({
            status: z.string(),
            count: z.number(),
        })),
    }),
    pendingApprovals: z.object({
        count: z.number(),
        avgWaitHours: z.number(),
        overdueCount: z.number(),
        isAlert: z.boolean(), // True if >20 samples OR avg wait >24h
    }),
    onTimeRate: z.object({
        value: z.number(), // Percentage
        trend: z.number(),
        color: z.enum(['green', 'yellow', 'red']),
    }),
    errorRate: z.object({
        value: z.number(), // Percentage
        totalModifications: z.number(),
        totalResults: z.number(),
        trend: z.number(),
    }),
})

export type KPIMetrics = z.infer<typeof KPIMetricsSchema>

// TAT Trend Data for line chart
export const TATTrendDataSchema = z.object({
    date: z.string(), // ISO date string
    avgTATHours: z.number(),
    sampleCount: z.number(),
})

export type TATTrendData = z.infer<typeof TATTrendDataSchema>

// Sample Accession Trend Data for combined bar + line chart
export const SampleAccessionTrendDataSchema = z.object({
    period: z.string(), // "2024-01-15" (daily), "2024-01" (monthly), "2024" (yearly)
    sampleCount: z.number(), // Samples received in this period
    cumulativeCount: z.number(), // Running total up to this period
})

export type SampleAccessionTrendData = z.infer<typeof SampleAccessionTrendDataSchema>

// Sample Status Distribution for bar chart
export const SampleStatusDataSchema = z.object({
    status: z.string(),
    count: z.number(),
})

export type SampleStatusData = z.infer<typeof SampleStatusDataSchema>

// CoA Statistics for donut chart
export const CoAStatisticsSchema = z.object({
    segment: z.string(), // 'Generated', 'Pending CoA', 'Not Approved'
    count: z.number(),
    percentage: z.number(),
})

export type CoAStatistics = z.infer<typeof CoAStatisticsSchema>

// Staff Productivity Data (Manager-only)
export const StaffProductivityDataSchema = z.object({
    analystId: z.string().uuid(),
    analystName: z.string(),
    testsCompleted: z.number(),
    resultsModified: z.number(),
})

export type StaffProductivityData = z.infer<typeof StaffProductivityDataSchema>

// Recent Sample for table display
export const RecentSampleSchema = z.object({
    id: z.string().uuid(),
    sampleId: z.string(),
    clientName: z.string(),
    receivedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    status: SampleStatus,
    tatHours: z.number().nullable(),
})

export type RecentSample = z.infer<typeof RecentSampleSchema>
