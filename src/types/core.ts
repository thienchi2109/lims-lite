import { z } from 'zod'

// ============================================================================
// ENUMS
// ============================================================================

export const UserRole = z.enum(['analyst', 'manager', 'doctor'])
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
    can_access_confidential: z.boolean().default(false),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
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
    can_access_confidential: z.boolean().optional(),
    otpEmail: z.string().email('Email OTP không hợp lệ').optional(),
}).superRefine((data, ctx) => {
    if (data.role === 'manager' && !data.email) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['email'],
            message: 'Email là bắt buộc để quản lý nhận OTP xác thực',
        })
    }
})

export type CreateUser = z.infer<typeof CreateUserSchema>

export const UpdateUserSchema = z.object({
    id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID format'),
    full_name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    lab: z.string().optional(),
    role: UserRole.optional(),
    password: z.string().min(8).optional(),
    can_access_confidential: z.boolean().optional(),
    otpEmail: z.string().email('Email OTP không hợp lệ').optional(),
})

export type UpdateUser = z.infer<typeof UpdateUserSchema>

export const ConfigureManagerOtpEmailSchema = z.object({
    userId: z.string().uuid('ID người dùng không hợp lệ'),
    otpEmail: z.string().email('Email OTP không hợp lệ'),
})

export type ConfigureManagerOtpEmail = z.infer<typeof ConfigureManagerOtpEmailSchema>

export const ManagerStepUpPayloadSchema = z.object({
    userId: z.string().min(1),
    sessionId: z.string().min(1),
    cohort: z.enum(['standard', 'confidential']),
    otpEmailUpdatedAt: z.string().min(1),
    expiresAt: z.string().datetime(),
})

export type ManagerStepUpPayload = z.infer<typeof ManagerStepUpPayloadSchema>

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
