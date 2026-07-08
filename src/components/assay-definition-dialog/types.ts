import { z } from 'zod'

// Validation rules for assay results
export const ValidationRulesSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  type: z.enum(['numeric', 'text', 'boolean']).optional(),
  required: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.min !== undefined && data.max !== undefined) {
      return data.min < data.max
    }
    return true
  },
  { message: 'Giá trị tối thiểu phải nhỏ hơn giá trị tối đa', path: ['min'] }
)

// Main form schema for creating/editing assay definitions
export const AssayFormSchema = z.object({
  name: z.string().min(1, 'Tên chỉ tiêu là bắt buộc'),
  specialtyId: z.string().min(1, 'Vui lòng chọn nhóm kỹ thuật'),
  methodName: z.string().trim().min(1, 'Phương pháp là bắt buộc').max(200, 'Phương pháp tối đa 200 ký tự'),
  units: z.string().optional(),
  normalRange: z.string().optional(),
  validationRules: ValidationRulesSchema.optional(),
  isConfidential: z.boolean(),
})

// Type exports
export type AssayFormValues = z.infer<typeof AssayFormSchema>
export type ValidationRules = z.infer<typeof ValidationRulesSchema>
export type AssayFormMode = 'create' | 'edit' | 'view'

// Re-export existing types used by the dialog
export type Method = {
  id: string
  name: string
  description: string | null
}

export type AssayMethod = {
  id: string
  method_id: string
  name: string
  is_default: boolean
  notes: string | null
}

// Raw validation rules from database (may have extra keys)
export type RawValidationRules = {
  min?: number
  max?: number
  type?: 'numeric' | 'text' | 'boolean'
  dataType?: string // legacy field name
  required?: boolean
}

export type AssayDefinition = {
  id: string
  name: string
  specialty_id?: string | null
  method_name?: string | null
  normal_range?: string | null
  units: string | null
  is_confidential?: boolean
  // Using Record for compatibility with existing code that uses Record<string, any>
  // RawValidationRules is used for type-safe access in the hook
  validation_rules: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
  methods?: AssayMethod[]
}
