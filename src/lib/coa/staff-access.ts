/**
 * Shared staff authorization and released CoA report loading.
 * HTTP routes map the typed failure reasons to their own response contracts.
 */

import {
    getUserConfidentialAccess,
    isConfidentialAssociatedSample,
} from '@/lib/data/confidential-samples'
import type { createClient } from '@/lib/supabase/server'

const STAFF_COA_ROLES = new Set(['analyst', 'manager', 'doctor'])

export type StaffCoAAccessClient = Awaited<ReturnType<typeof createClient>>

export type StaffCoAAccessFailureReason =
    | 'unauthenticated'
    | 'user-not-found'
    | 'role-forbidden'
    | 'missing-sample-id'
    | 'confidential-access-error'
    | 'not-found'
    | 'sample-not-completed'
    | 'report-not-ready'

export type AuthorizedStaffCoA = {
    ok: true
    userId: string
    sample: {
        id: string
        sampleId: string
    }
    report: {
        id: string
        filePath: string
        fileHash: string | null
        generatedAt: string
        version: number
    }
}

export type StaffCoAAccessResult =
    | AuthorizedStaffCoA
    | {
          ok: false
          reason: StaffCoAAccessFailureReason
      }

export async function loadAuthorizedStaffCoA(
    supabase: StaffCoAAccessClient,
    sampleId: string | null,
): Promise<StaffCoAAccessResult> {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return failure('unauthenticated')
    }

    const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (roleError || !userData) {
        return failure('user-not-found')
    }

    if (!STAFF_COA_ROLES.has(userData.role)) {
        return failure('role-forbidden')
    }

    if (!sampleId) {
        return failure('missing-sample-id')
    }

    const access = await getUserConfidentialAccess(user.id, supabase)
    if (access.error) {
        return failure('confidential-access-error')
    }

    if (!access.canAccessConfidential) {
        try {
            const confidentialSample =
                await isConfidentialAssociatedSample(sampleId)

            if (confidentialSample.data) {
                return failure('not-found')
            }
        } catch (error) {
            console.error(
                'Confidential CoA association check failed:',
                error,
            )
            return failure('not-found')
        }
    }

    const { data: sample, error: sampleError } = await supabase
        .from('samples')
        .select('id, sample_id, status')
        .eq('id', sampleId)
        .is('deleted_at', null)
        .single()

    if (sampleError || !sample) {
        return failure('not-found')
    }

    if (sample.status !== 'completed') {
        return failure('sample-not-completed')
    }

    const { data: coaReport, error: coaError } = await supabase
        .from('coa_reports')
        .select('id, file_path, file_hash, generated_at, version')
        .eq('sample_id', sampleId)
        .eq('status', 'ready')
        .is('deleted_at', null)
        .order('version', { ascending: false })
        .limit(1)
        .single()

    if (coaError || !coaReport) {
        return failure('report-not-ready')
    }

    return {
        ok: true,
        userId: user.id,
        sample: {
            id: sample.id,
            sampleId: sample.sample_id,
        },
        report: {
            id: coaReport.id,
            filePath: coaReport.file_path,
            fileHash: coaReport.file_hash,
            generatedAt: coaReport.generated_at,
            version: coaReport.version,
        },
    }
}

function failure(
    reason: StaffCoAAccessFailureReason,
): StaffCoAAccessResult {
    return {
        ok: false,
        reason,
    }
}
