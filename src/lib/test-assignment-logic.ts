/**
 * Shared logic for test assignment functionality
 * Used by both TestAssignmentModule (samples page) and TestAssignmentGrid (accessions page)
 */

export type MethodSelectionPriority =
  | 'user_selected'      // User explicitly chose this method
  | 'filter_selected'    // User filtered by method (auto-select)
  | 'default_method'     // Assay has default method
  | 'first_available'    // Fallback to first method
  | 'none'               // No method available/selected

export interface MethodSelectionResult {
  methodId: string | null
  priority: MethodSelectionPriority
  warning?: string  // e.g., "Xét nghiệm không có phương pháp"
}

export interface AssayWithMethods {
  id: string
  name: string
  code?: string
  specialty_id?: string | null
  default_method_id?: string | null
  methods: Array<{
    id: string
    name: string
    is_default: boolean
  }>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Smart method selection logic
 * Priority: user selection > filter > default > first available > null
 */
export function getMethodForAssay(
  assay: AssayWithMethods,
  options: {
    userSelectedMethodId?: string | null
    filterMethodId?: string | null
  } = {}
): MethodSelectionResult {

  // Priority 1: User explicitly selected a method
  if (options.userSelectedMethodId) {
    return {
      methodId: options.userSelectedMethodId,
      priority: 'user_selected'
    }
  }

  // Priority 2: User filtered by method (auto-select that method)
  if (options.filterMethodId && assay.methods.some(m => m.id === options.filterMethodId)) {
    return {
      methodId: options.filterMethodId,
      priority: 'filter_selected'
    }
  }

  // Priority 3: Assay has a default method
  if (assay.default_method_id) {
    return {
      methodId: assay.default_method_id,
      priority: 'default_method'
    }
  }

  // Priority 4: Use first available method (if any)
  if (assay.methods.length > 0) {
    return {
      methodId: assay.methods[0].id,
      priority: 'first_available',
      warning: `Xét nghiệm "${assay.name}" không có phương pháp mặc định. Sử dụng "${assay.methods[0].name}".`
    }
  }

  // Priority 5: No method available - allow NULL
  return {
    methodId: null,
    priority: 'none',
    warning: `Xét nghiệm "${assay.name}" chưa có phương pháp. Kết quả sẽ được lưu không có phương pháp.`
  }
}

/**
 * Validate test assignments before submitting
 */
export function validateAssignments(
  assignments: Array<{
    assay: AssayWithMethods
    methodId: string | null
  }>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (assignments.length === 0) {
    errors.push('Vui lòng chọn ít nhất một xét nghiệm.')
  }

  // Track method-less assignments
  const methodlessCount = assignments.filter(a => !a.methodId).length

  if (methodlessCount > 0) {
    warnings.push(
      `${methodlessCount} xét nghiệm không có phương pháp sẽ được lưu. ` +
      `Quản lý cần bổ sung phương pháp sau.`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Prepare assignment data for RPC call
 * Removes duplicates based on (assayId, methodId) combination
 */
export function prepareAssignmentData(
  assignments: Array<{
    assayId: string
    methodId: string | null
  }>
): Array<{ assayId: string; methodId: string | null }> {

  // Remove duplicates (same assay + method combination)
  const seen = new Set<string>()

  return assignments.filter(assignment => {
    const key = `${assignment.assayId}:${assignment.methodId || 'NULL'}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
