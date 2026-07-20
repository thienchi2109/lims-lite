/**
 * Persists client PDF access outcomes using a bounded failure reason vocabulary.
 */

import type { createAdminClient } from '@/lib/supabase/server'

export const CLIENT_COA_PDF_FAILURE_REASONS = [
    'sample_not_found',
    'ownership_forbidden',
    'confidential_concealed',
    'confidential_check_failed',
    'sample_not_completed',
    'report_not_ready',
    'rate_limited',
    'storage_unavailable',
    'integrity_failed',
    'gateway_configuration',
    'gateway_authentication',
    'gateway_timeout',
    'gateway_service_unavailable',
    'gateway_rejected',
    'gateway_invalid_response',
    'unexpected_failure',
] as const

export type ClientCoAPdfAuditFailureReason =
    (typeof CLIENT_COA_PDF_FAILURE_REASONS)[number]

export type ClientCoAPdfAuditClient = ReturnType<typeof createAdminClient>

export class ClientCoAPdfAuditValidationError extends Error {
    constructor() {
        super('Thông tin nhật ký tải PDF không hợp lệ')
        this.name = 'ClientCoAPdfAuditValidationError'
    }
}

export class ClientCoAPdfAuditPersistenceError extends Error {
    constructor() {
        super('Không thể ghi nhật ký tải PDF')
        this.name = 'ClientCoAPdfAuditPersistenceError'
    }
}

type ClientCoAPdfAuditEntry = {
    clientId: string
    sampleId: string | null
    coaReportId: string | null
    ipAddress: string
    userAgent: string
    success: boolean
    failureReason: string | null
}

const failureReasonAllowlist: ReadonlySet<string> = new Set(
    CLIENT_COA_PDF_FAILURE_REASONS,
)

export async function persistClientCoAPdfAudit(
    client: ClientCoAPdfAuditClient,
    entry: ClientCoAPdfAuditEntry,
): Promise<void> {
    validateAuditOutcome(entry.success, entry.failureReason)

    try {
        const { error } = await client.from('coa_access_log').insert({
            client_id: entry.clientId,
            sample_id: entry.sampleId,
            coa_report_id: entry.coaReportId,
            ip_address: entry.ipAddress,
            user_agent: entry.userAgent,
            success: entry.success,
            failure_reason: entry.failureReason,
        })

        if (error) {
            throw new ClientCoAPdfAuditPersistenceError()
        }
    } catch (error) {
        if (error instanceof ClientCoAPdfAuditPersistenceError) {
            throw error
        }
        throw new ClientCoAPdfAuditPersistenceError()
    }
}

function validateAuditOutcome(
    success: boolean,
    failureReason: string | null,
): void {
    if (success) {
        if (failureReason !== null) {
            throw new ClientCoAPdfAuditValidationError()
        }
        return
    }

    if (
        failureReason === null ||
        !failureReasonAllowlist.has(failureReason)
    ) {
        throw new ClientCoAPdfAuditValidationError()
    }
}
