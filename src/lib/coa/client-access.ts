/**
 * Resolves client CoA identity before narrowly scoped service-role access.
 * HTTP routes own response mapping, storage access, and audit persistence.
 */

import { isConfidentialAssociatedSample } from '@/lib/data/confidential-samples'
import { isTokenExpired, verifyCoAToken } from '@/lib/jwt'
import type { createAdminClient } from '@/lib/supabase/server'

type ClientCoAIdentityRequest = {
    headers: Headers
    cookies: {
        get(name: string): { value: string } | undefined
    }
}

export type ClientCoAAccessClient = ReturnType<typeof createAdminClient>

export type ClientCoAIdentityFailureReason =
    | 'missing-token'
    | 'invalid-token'
    | 'expired-token'

export type ClientCoAAccessFailureReason =
    | 'sample-not-found'
    | 'ownership-forbidden'
    | 'not-found'
    | 'confidential-check-failed'
    | 'sample-not-completed'
    | 'report-not-ready'

export type ClientCoAIdentityResult =
    | {
          ok: true
          clientId: string
      }
    | {
          ok: false
          reason: ClientCoAIdentityFailureReason
      }

export type AuthorizedClientCoA = {
    clientId: string
    sample: {
        id: string
        sampleId: string
    }
    report: {
        id: string
        filePath: string
        fileHash: string | null
        generatedAt: string | null
        version: number
    }
}

export type ClientCoAAccessResult =
    | ({
          ok: true
      } & AuthorizedClientCoA)
    | {
          ok: false
          clientId: string
          reason: ClientCoAAccessFailureReason
      }

export async function resolveClientCoAIdentity(
    request: ClientCoAIdentityRequest,
): Promise<ClientCoAIdentityResult> {
    const authorization = request.headers.get('authorization')
    const headerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    const cookieToken = request.cookies.get('coa_token')?.value
    const token = headerToken || cookieToken

    if (!token) {
        return identityFailure('missing-token')
    }

    try {
        const tokenPayload = await verifyCoAToken(token)

        if (isTokenExpired(tokenPayload)) {
            return identityFailure('expired-token')
        }

        return {
            ok: true,
            clientId: tokenPayload.client_id,
        }
    } catch {
        return identityFailure('invalid-token')
    }
}

export async function loadAuthorizedClientCoA(
    client: ClientCoAAccessClient,
    clientId: string,
    sampleId: string,
): Promise<ClientCoAAccessResult> {
    const { data: sample, error: sampleError } = await client
        .from('samples')
        .select('id, sample_id, client_id, status')
        .eq('id', sampleId)
        .is('deleted_at', null)
        .single()

    if (sampleError || !sample) {
        return accessFailure(clientId, 'sample-not-found')
    }

    if (sample.client_id !== clientId) {
        return accessFailure(clientId, 'ownership-forbidden')
    }

    try {
        const confidentialSample =
            await isConfidentialAssociatedSample(sampleId)

        if (confidentialSample.data) {
            return accessFailure(clientId, 'not-found')
        }
    } catch {
        return accessFailure(clientId, 'confidential-check-failed')
    }

    if (sample.status !== 'completed') {
        return accessFailure(clientId, 'sample-not-completed')
    }

    const { data: report, error: reportError } = await client
        .from('coa_reports')
        .select('id, file_path, file_hash, generated_at, version')
        .eq('sample_id', sampleId)
        .eq('status', 'ready')
        .is('deleted_at', null)
        .order('version', { ascending: false })
        .limit(1)
        .single()

    if (reportError || !report) {
        return accessFailure(clientId, 'report-not-ready')
    }

    return {
        ok: true,
        clientId,
        sample: {
            id: sample.id,
            sampleId: sample.sample_id,
        },
        report: {
            id: report.id,
            filePath: report.file_path,
            fileHash: report.file_hash,
            generatedAt: report.generated_at,
            version: report.version,
        },
    }
}

function identityFailure(
    reason: ClientCoAIdentityFailureReason,
): ClientCoAIdentityResult {
    return {
        ok: false,
        reason,
    }
}

function accessFailure(
    clientId: string,
    reason: ClientCoAAccessFailureReason,
): ClientCoAAccessResult {
    return {
        ok: false,
        clientId,
        reason,
    }
}
