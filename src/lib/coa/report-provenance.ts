/**
 * CoA report provenance data access.
 *
 * Binds generation to one reviewed submission and resolves immutable result
 * snapshots for final rendering, retries, and regeneration.
 */

import { z } from 'zod'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
    ResultReferenceAssessmentSchema,
    type LatestSubmission,
} from '@/types'
import type { TestResult } from './helpers'
export {
    completeCoAReportGeneration,
    type CompleteCoAReportInput,
    type CompleteCoAReportOutcome,
} from './report-completion'

const CoAReportQueueResponseSchema = z.object({
    report_id: z.string().uuid(),
    status: z.enum(['pending', 'ready', 'failed']),
    file_path: z.string().nullable(),
    source_submission_id: z.string().uuid().nullable(),
    claimed: z.boolean(),
    generation_claim_id: z.string().uuid().nullable(),
    previous_status: z.enum(['ready', 'failed']).nullable(),
    blocked_reason: z
        .literal('HISTORIC_REPORT_WITHOUT_SOURCE')
        .nullable()
        .optional(),
})

const JoinedSpecialtySchema = z.object({
    name: z.string().nullable(),
    display_order: z.number().int().nullable(),
})

const JoinedAssaySchema = z.object({
    lab_specialties: z.union([
        JoinedSpecialtySchema,
        z.array(JoinedSpecialtySchema),
    ]).nullable(),
})

const JoinedResultSchema = z.object({
    assay_definitions: z.union([
        JoinedAssaySchema,
        z.array(JoinedAssaySchema),
    ]).nullable(),
})

const SnapshotRowSchema = z.object({
    result_id: z.string().uuid(),
    assessment: ResultReferenceAssessmentSchema,
    assay_name: z.string(),
    result_value: z.string(),
    unit: z.string().nullable(),
    method_name: z.string().nullable(),
    reference_range: z.string().nullable(),
    result: z.union([
        JoinedResultSchema,
        z.array(JoinedResultSchema),
    ]).nullable(),
})

const SubmissionRowSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    signature_id: z.string().uuid(),
    submitted_at: z.string(),
    submission_number: z.number().int().positive(),
    signature_meaning: z.string(),
    user: z.union([
        z.object({ full_name: z.string().nullable() }),
        z.array(z.object({ full_name: z.string().nullable() })),
    ]).nullable(),
})

const SubmissionSignatureSchema = z.object({
    signature_hash: z.string().min(1),
    signature_path: z.string().min(1),
})

export interface CoAReportSource {
    reportId: string
    status: 'pending' | 'ready' | 'failed'
    filePath: string | null
    sourceSubmissionId: string | null
    claimed: boolean
    generationClaimId: string | null
    previousStatus: 'ready' | 'failed' | null
    blockedReason?: 'HISTORIC_REPORT_WITHOUT_SOURCE'
}

function firstJoined<T>(value: T | T[] | null): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value
}

export async function queueCoAReportForGeneration(
    sampleId: string,
    version = 1,
): Promise<CoAReportSource | null> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
        'queue_coa_report_for_generation',
        {
            p_sample_id: sampleId,
            p_version: version,
        },
    )

    if (error) {
        console.error('Queue CoA report error:', error)
        return null
    }

    const parsed = CoAReportQueueResponseSchema.safeParse(data)
    if (!parsed.success) {
        console.error('Invalid CoA report queue response:', parsed.error)
        return null
    }

    return {
        reportId: parsed.data.report_id,
        status: parsed.data.status,
        filePath: parsed.data.file_path,
        sourceSubmissionId: parsed.data.source_submission_id,
        claimed: parsed.data.claimed,
        generationClaimId: parsed.data.generation_claim_id,
        previousStatus: parsed.data.previous_status,
    }
}

export async function claimCoAReportForRegeneration(
    sampleId: string,
    version = 1,
): Promise<CoAReportSource | null> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
        'claim_coa_report_regeneration',
        {
            p_sample_id: sampleId,
            p_version: version,
        },
    )

    if (error) {
        console.error('Claim CoA regeneration error:', error)
        return null
    }

    const parsed = CoAReportQueueResponseSchema.safeParse(data)
    if (!parsed.success) {
        console.error('Invalid CoA regeneration claim response:', parsed.error)
        return null
    }

    return {
        reportId: parsed.data.report_id,
        status: parsed.data.status,
        filePath: parsed.data.file_path,
        sourceSubmissionId: parsed.data.source_submission_id,
        claimed: parsed.data.claimed,
        generationClaimId: parsed.data.generation_claim_id,
        previousStatus: parsed.data.previous_status,
        blockedReason: parsed.data.blocked_reason ?? undefined,
    }
}

export async function failCoAReportGeneration(
    reportId: string,
    generationClaimId: string,
    errorMessage: string,
    restoreReady: boolean,
): Promise<boolean> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
        'fail_coa_report_generation',
        {
            p_report_id: reportId,
            p_generation_claim_id: generationClaimId,
            p_error_message: errorMessage,
            p_restore_ready: restoreReady,
        },
    )

    if (error) {
        console.error('Record CoA generation failure error:', error)
        return false
    }

    const parsed = z.boolean().safeParse(data)
    if (!parsed.success) {
        console.error('Invalid CoA failure response:', parsed.error)
        return false
    }

    return parsed.data
}

export async function fetchSubmissionById(
    submissionId: string,
): Promise<LatestSubmission | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('sample_submissions')
        .select(`
            id,
            user_id,
            signature_id,
            submitted_at,
            submission_number,
            signature_meaning,
            user:users!sample_submissions_user_id_fkey(full_name)
        `)
        .eq('id', submissionId)
        .maybeSingle()

    if (error || !data) {
        console.error('Fetch CoA source submission error:', error)
        return null
    }

    const parsed = SubmissionRowSchema.safeParse(data)
    if (!parsed.success) {
        console.error('Invalid CoA source submission response:', parsed.error)
        return null
    }

    const user = firstJoined(parsed.data.user)
    const adminClient = createAdminClient()
    const { data: signatureData, error: signatureError } = await adminClient
        .from('user_signatures')
        .select('signature_hash, signature_path')
        .eq('id', parsed.data.signature_id)
        .eq('user_id', parsed.data.user_id)
        .maybeSingle()

    if (signatureError || !signatureData) {
        console.error(
            'Fetch CoA source submission signature error:',
            signatureError,
        )
        return null
    }

    const signature = SubmissionSignatureSchema.safeParse(signatureData)
    if (!signature.success) {
        console.error('Invalid CoA source submission signature:', signature.error)
        return null
    }

    return {
        submissionId: parsed.data.id,
        performerId: parsed.data.user_id,
        performerName: user?.full_name ?? null,
        signatureId: parsed.data.signature_id,
        signatureHash: signature.data.signature_hash,
        signaturePath: signature.data.signature_path,
        submittedAt: parsed.data.submitted_at,
        submissionNumber: parsed.data.submission_number,
        signatureMeaning: parsed.data.signature_meaning,
    }
}

export async function fetchSnapshotTestResults(
    submissionId: string,
): Promise<TestResult[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('result_reference_assessments')
        .select(`
            result_id,
            assessment,
            assay_name,
            result_value,
            unit,
            method_name,
            reference_range,
            result:results!inner (
                assay_definitions!inner (
                    lab_specialties (
                        name,
                        display_order
                    )
                )
            )
        `)
        .eq('submission_id', submissionId)

    if (error || !data) {
        console.error('Fetch CoA snapshot results error:', error)
        return []
    }

    const parsed = z.array(SnapshotRowSchema).safeParse(data)
    if (!parsed.success) {
        console.error('Invalid CoA snapshot results response:', parsed.error)
        return []
    }

    return parsed.data
        .map((row) => {
            const result = firstJoined(row.result)
            const assay = firstJoined(result?.assay_definitions ?? null)
            const specialty = firstJoined(assay?.lab_specialties ?? null)

            return {
                result_id: row.result_id,
                assessment: row.assessment,
                assay_name: row.assay_name,
                value: row.result_value,
                unit: row.unit,
                normal_range: row.reference_range,
                method_name: row.method_name,
                lab_specialty_name: specialty?.name ?? null,
                specialtyDisplayOrder: specialty?.display_order ?? 9999,
            }
        })
        .sort((left, right) => (
            left.specialtyDisplayOrder - right.specialtyDisplayOrder
            || left.assay_name.localeCompare(right.assay_name)
        ))
        .map((result) => ({
            result_id: result.result_id,
            assessment: result.assessment,
            assay_name: result.assay_name,
            value: result.value,
            unit: result.unit,
            normal_range: result.normal_range,
            method_name: result.method_name,
            lab_specialty_name: result.lab_specialty_name,
        }))
}
