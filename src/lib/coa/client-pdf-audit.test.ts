/**
 * Locks the client PDF audit reason allowlist and fail-closed persistence.
 */

import { describe, expect, it, vi } from 'vitest'
import {
    CLIENT_COA_PDF_FAILURE_REASONS,
    ClientCoAPdfAuditPersistenceError,
    ClientCoAPdfAuditValidationError,
    persistClientCoAPdfAudit,
    type ClientCoAPdfAuditClient,
} from './client-pdf-audit'

function createAuditClient(error: { message: string } | null = null) {
    const insert = vi.fn().mockResolvedValue({
        data: null,
        error,
    })
    const from = vi.fn((table: string) => {
        if (table !== 'coa_access_log') {
            throw new Error(`Unexpected table: ${table}`)
        }
        return { insert }
    })

    return {
        client: { from } as unknown as ClientCoAPdfAuditClient,
        from,
        insert,
    }
}

describe('persistClientCoAPdfAudit', () => {
    it('persists a successful PDF access with no failure reason', async () => {
        const { client, insert } = createAuditClient()

        await persistClientCoAPdfAudit(client, {
            clientId: 'client-1',
            sampleId: 'sample-1',
            coaReportId: 'report-1',
            ipAddress: '203.0.113.10',
            userAgent: 'Vitest',
            success: true,
            failureReason: null,
        })

        expect(insert).toHaveBeenCalledWith({
            client_id: 'client-1',
            sample_id: 'sample-1',
            coa_report_id: 'report-1',
            ip_address: '203.0.113.10',
            user_agent: 'Vitest',
            success: true,
            failure_reason: null,
        })
    })

    it.each(CLIENT_COA_PDF_FAILURE_REASONS)(
        'persists allowlisted failure reason %s',
        async (failureReason) => {
            const { client, insert } = createAuditClient()

            await persistClientCoAPdfAudit(client, {
                clientId: 'client-1',
                sampleId: 'sample-1',
                coaReportId: null,
                ipAddress: '203.0.113.10',
                userAgent: 'Vitest',
                success: false,
                failureReason,
            })

            expect(insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    failure_reason: failureReason,
                }),
            )
        },
    )

    it('rejects a failure reason outside the allowlist before insert', async () => {
        const { client, insert } = createAuditClient()

        await expect(
            persistClientCoAPdfAudit(client, {
                clientId: 'client-1',
                sampleId: 'sample-1',
                coaReportId: null,
                ipAddress: '203.0.113.10',
                userAgent: 'Vitest',
                success: false,
                failureReason: 'sensitive upstream error',
            }),
        ).rejects.toBeInstanceOf(ClientCoAPdfAuditValidationError)
        expect(insert).not.toHaveBeenCalled()
    })

    it('rejects inconsistent success and failure reason values', async () => {
        const { client, insert } = createAuditClient()

        await expect(
            persistClientCoAPdfAudit(client, {
                clientId: 'client-1',
                sampleId: 'sample-1',
                coaReportId: 'report-1',
                ipAddress: '203.0.113.10',
                userAgent: 'Vitest',
                success: true,
                failureReason: 'gateway_timeout',
            }),
        ).rejects.toBeInstanceOf(ClientCoAPdfAuditValidationError)
        expect(insert).not.toHaveBeenCalled()
    })

    it('throws a generic persistence error when the audit insert fails', async () => {
        const { client } = createAuditClient({
            message: 'sensitive database error',
        })

        const result = persistClientCoAPdfAudit(client, {
            clientId: 'client-1',
            sampleId: 'sample-1',
            coaReportId: 'report-1',
            ipAddress: '203.0.113.10',
            userAgent: 'Vitest',
            success: true,
            failureReason: null,
        })

        await expect(result).rejects.toBeInstanceOf(
            ClientCoAPdfAuditPersistenceError,
        )
        await expect(result).rejects.toThrow(
            'Không thể ghi nhật ký tải PDF',
        )
        await expect(result).rejects.not.toThrow('sensitive database error')
    })

    it('normalizes a rejected audit insert without exposing its error', async () => {
        const insert = vi
            .fn()
            .mockRejectedValue(
                new Error('sensitive transport error public-token'),
            )
        const client = {
            from: vi.fn(() => ({ insert })),
        } as unknown as ClientCoAPdfAuditClient

        const result = persistClientCoAPdfAudit(client, {
            clientId: 'client-1',
            sampleId: 'sample-1',
            coaReportId: 'report-1',
            ipAddress: '203.0.113.10',
            userAgent: 'Vitest',
            success: true,
            failureReason: null,
        })

        await expect(result).rejects.toBeInstanceOf(
            ClientCoAPdfAuditPersistenceError,
        )
        await expect(result).rejects.not.toThrow('public-token')
        await expect(result).rejects.not.toThrow('sensitive transport error')
    })
})
