'use server'

/**
 * Results Validation Helpers
 * Extracted from results.ts to reduce file size
 * Functions: validateResultValue, validateResultsBatch
 */

import { createClient } from '@/lib/supabase/server'
import { validateNumericValue, validateTextValue } from '@/lib/utils-lims'

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
    id: string
    error: string
}

export interface ResultValidationContext {
    id: string
    status: string
    sample_id: string
    assay_id: string
    sample?: { id: string; status: string } | { id: string; status: string }[] | null
    assay?: { validation_rules: Record<string, unknown> } | { validation_rules: Record<string, unknown> }[] | null
}

export interface ValidatedResultInput {
    id: string
    value: string
}

// ============================================================================
// SINGLE VALUE VALIDATION
// ============================================================================

/**
 * Validates a result value against its assay validation rules
 */
export async function validateResultValue(
    value: string,
    rules: Record<string, unknown>
): Promise<string | null> {
    // Determine if numeric or text based on rules
    if (rules.type === 'numeric' || rules.min !== undefined || rules.max !== undefined) {
        return validateNumericValue(value, rules)
    }

    return validateTextValue(value, rules)
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

/**
 * Fetches results for validation with related data
 */
export async function fetchResultsForValidation(resultIds: string[]) {
    const supabase = await createClient()

    const { data: existingResults, error } = await supabase
        .from('results')
        .select(
            `
            id,
            status,
            sample_id,
            assay_id,
            sample:samples!results_sample_id_fkey(id, status),
            assay:assay_definitions!results_assay_id_fkey(
                validation_rules
            )
        `
        )
        .in('id', resultIds)

    if (error) {
        return { error: error.message }
    }

    return { data: existingResults as unknown as ResultValidationContext[] }
}

/**
 * Checks if sample status allows editing
 */
export async function checkSampleEditability(existingResults: ResultValidationContext[]): Promise<string | null> {
    const sampleData = existingResults[0]?.sample
    const sampleStatus = Array.isArray(sampleData) ? sampleData[0]?.status : sampleData?.status

    if (['review', 'completed', 'discarded'].includes(sampleStatus || '')) {
        return 'Cannot edit results for samples under review, discarded, or completed'
    }

    return null
}

/**
 * Validates a batch of result values against their assay rules
 * Also checks permissions based on user role
 */
export async function validateResultsBatch(
    inputs: ValidatedResultInput[],
    existingResults: ResultValidationContext[],
    userId: string
): Promise<ValidationError[]> {
    const supabase = await createClient()
    const validationErrors: ValidationError[] = []

    // Get user role once
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

    const isManager = userData?.role === 'manager'

    for (const resultInput of inputs) {
        const existing = existingResults.find((r) => r.id === resultInput.id)

        if (!existing) {
            validationErrors.push({ id: resultInput.id, error: 'Result not found' })
            continue
        }

        // Check if result is approved (analysts cannot edit)
        if (!isManager && existing.status === 'approved') {
            validationErrors.push({
                id: resultInput.id,
                error: 'Cannot edit approved results',
            })
            continue
        }

        // Validate value against assay rules - handle array or single object
        const assayData = Array.isArray(existing.assay) ? existing.assay[0] : existing.assay
        const rules = (assayData?.validation_rules as Record<string, unknown>) || {}
        const validationError = await validateResultValue(resultInput.value, rules)
        if (validationError) {
            validationErrors.push({ id: resultInput.id, error: validationError })
        }
    }

    return validationErrors
}
