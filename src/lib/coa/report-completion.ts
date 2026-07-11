/**
 * Completes a claimed CoA report and reconciles ambiguous RPC responses.
 */

import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const CoAReportCompletionResponseSchema = z.object({
    report_id: z.string().uuid(),
    previous_file_path: z.string().nullable(),
})

const CoAReportReconciliationSchema = z.object({
    status: z.enum(['pending', 'ready', 'failed']),
    file_path: z.string().nullable(),
    file_hash: z.string().nullable(),
})

export interface CompleteCoAReportInput {
    filePath: string
    fileHash: string
    signatureId: string
}

export type CompleteCoAReportOutcome =
    | {
        status: 'completed'
        reportId: string
        previousFilePath: string | null
    }
    | { status: 'rejected' }
    | { status: 'indeterminate' }

export async function completeCoAReportGeneration(
    reportId: string,
    generationClaimId: string,
    input: CompleteCoAReportInput,
): Promise<CompleteCoAReportOutcome> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
        'complete_coa_report_generation',
        {
            p_report_id: reportId,
            p_generation_claim_id: generationClaimId,
            p_file_path: input.filePath,
            p_file_hash: input.fileHash,
            p_signature_id: input.signatureId,
        },
    )

    if (!error && data === null) {
        return { status: 'rejected' }
    }

    const parsed = CoAReportCompletionResponseSchema.safeParse(data)
    if (!error && parsed.success) {
        return {
            status: 'completed',
            reportId: parsed.data.report_id,
            previousFilePath: parsed.data.previous_file_path,
        }
    }

    if (error) {
        console.error('Complete CoA generation error:', error)
    } else {
        console.error('Invalid CoA completion response:', parsed.error)
    }

    const { data: report, error: reconciliationError } = await supabase
        .from('coa_reports')
        .select('status, file_path, file_hash')
        .eq('id', reportId)
        .maybeSingle()

    if (reconciliationError) {
        console.error('Reconcile CoA completion error:', reconciliationError)
        return { status: 'indeterminate' }
    }

    if (!report) {
        return { status: 'rejected' }
    }

    const reconciled = CoAReportReconciliationSchema.safeParse(report)
    if (!reconciled.success) {
        console.error('Invalid CoA reconciliation response:', reconciled.error)
        return { status: 'indeterminate' }
    }

    if (
        reconciled.data.status === 'ready'
        && reconciled.data.file_path === input.filePath
        && reconciled.data.file_hash === input.fileHash
    ) {
        return {
            status: 'completed',
            reportId,
            previousFilePath: null,
        }
    }

    return { status: 'rejected' }
}
