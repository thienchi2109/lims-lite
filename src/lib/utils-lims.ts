/**
 * Utility functions for Hệ thống quản lý thông tin khoa Xét nghiệm
 */

/**
 * Generates a unique sample ID in the format: CDC-XN-ddmmyyyy-000x
 * @param existingCount - Number of samples already created today
 * @returns Generated sample ID
 */
export function generateSampleId(existingCount: number): string {
    const now = new Date()

    // Format date as ddmmyyyy
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = String(now.getFullYear())
    const dateStr = `${day}${month}${year}`

    // Increment count and pad to 4 digits
    const sequence = String(existingCount + 1).padStart(4, '0')

    return `CDC-XN-${dateStr}-${sequence}`
}

/**
 * Formats a date string to a readable format
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
    if (!dateString) return ''
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date)
}

/**
 * Gets the start and end of today in ISO format
 * @returns Object with startOfDay and endOfDay
 */
export function getTodayRange(): { startOfDay: string; endOfDay: string } {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    return {
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString(),
    }
}

/**
 * Debounce function for delayed execution
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null
            func(...args)
        }

        if (timeout) {
            clearTimeout(timeout)
        }
        timeout = setTimeout(later, wait)
    }
}

/**
 * Formats a date to relative time (e.g., "2 hours ago")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return formatDate(dateString)
}

// ============================================================================
// VALIDATION UTILITIES (Phase 3)
// ============================================================================

export type ValidationRule = {
    min?: number
    max?: number
    pattern?: string
    required?: boolean
}

/**
 * Validates a numeric value against validation rules
 * @param value - The value to validate
 * @param rules - Validation rules from assay definition
 * @returns Error message if invalid, null if valid
 */
export function validateNumericValue(value: string, rules: Record<string, any>): string | null {
    if (!value || value.trim() === '') {
        if (rules.required) return 'This field is required'
        return null
    }

    const numValue = parseFloat(value)
    if (isNaN(numValue)) {
        return 'Value must be a valid number'
    }

    if (rules.min !== undefined && numValue < rules.min) {
        return `Value must be at least ${rules.min}`
    }

    if (rules.max !== undefined && numValue > rules.max) {
        return `Value must be at most ${rules.max}`
    }

    return null
}

/**
 * Validates a text value against validation rules
 * @param value - The value to validate
 * @param rules - Validation rules from assay definition
 * @returns Error message if invalid, null if valid
 */
export function validateTextValue(value: string, rules: Record<string, any>): string | null {
    if (!value || value.trim() === '') {
        if (rules.required) return 'This field is required'
        return null
    }

    if (rules.pattern) {
        try {
            const regex = new RegExp(rules.pattern)
            if (!regex.test(value)) {
                return rules.patternMessage || 'Value does not match required format'
            }
        } catch (e) {
            console.error('Invalid regex pattern:', rules.pattern)
        }
    }

    if (rules.minLength !== undefined && value.length < rules.minLength) {
        return `Value must be at least ${rules.minLength} characters`
    }

    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        return `Value must be at most ${rules.maxLength} characters`
    }

    return null
}

/**
 * Formats a validation error message for display
 * @param field - Field name
 * @param rule - Rule that failed
 * @returns Formatted error message
 */
export function formatValidationError(field: string, rule: string): string {
    return `${field}: ${rule}`
}

