/**
 * Locks client PDF identity, access, and confidentiality failure behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateAdminClient = vi.fn()
const mockResolveClientCoAIdentity = vi.fn()
const mockLoadAuthorizedClientCoA = vi.fn()
const mockConvertHtmlToPdf = vi.fn()
const mockStorageDownload = vi.fn()
const mockAccessLogInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

vi.mock('@/lib/coa/client-access', () => ({
    resolveClientCoAIdentity: (...args: unknown[]) =>
        mockResolveClientCoAIdentity(...args),
    loadAuthorizedClientCoA: (...args: unknown[]) =>
        mockLoadAuthorizedClientCoA(...args),
}))

vi.mock('@/lib/coa/pdf/gateway-client', () => ({
    convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
}))

import { GET } from './route'

function createPdfRequest(ip: string) {
    return {
        url: 'http://localhost/api/coa/download/pdf?sample_id=sample-uuid',
        headers: new Headers({
            authorization: 'Bearer public-token',
            'user-agent': 'Vitest Client',
            'x-real-ip': ip,
        }),
        cookies: {
            get: vi.fn(() => undefined),
        },
    } as unknown as import('next/server').NextRequest
}

describe('GET /api/coa/download/pdf access failures', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockResolveClientCoAIdentity.mockResolvedValue({
            ok: true,
            clientId: 'client-1',
        })
        mockAccessLogInsert.mockResolvedValue({
            data: null,
            error: null,
        })
        mockCreateAdminClient.mockReturnValue({
            from: vi.fn((table: string) => {
                if (table !== 'coa_access_log') {
                    throw new Error(`Unexpected table: ${table}`)
                }
                return { insert: mockAccessLogInsert }
            }),
            storage: {
                from: vi.fn(() => ({
                    download: mockStorageDownload,
                })),
            },
        })
    })

    it.each([
        [
            'missing-token',
            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại',
        ],
        ['invalid-token', 'Token không hợp lệ hoặc đã hết hạn'],
        ['expired-token', 'Token đã hết hạn. Vui lòng đăng nhập lại'],
    ] as const)(
        'rejects %s before service-role access',
        async (reason, message) => {
            mockResolveClientCoAIdentity.mockResolvedValue({
                ok: false,
                reason,
            })

            const response = await GET(
                createPdfRequest(`203.0.113.${40 + reason.length}`),
            )

            expect(response.status).toBe(401)
            await expect(response.json()).resolves.toEqual({
                error: message,
            })
            expect(response.headers.get('set-cookie')).toContain(
                'coa_token=',
            )
            expect(mockCreateAdminClient).not.toHaveBeenCalled()
            expect(mockLoadAuthorizedClientCoA).not.toHaveBeenCalled()
            expect(mockConvertHtmlToPdf).not.toHaveBeenCalled()
            expect(mockAccessLogInsert).not.toHaveBeenCalled()
        },
    )

    it.each([
        [
            'sample-not-found',
            404,
            'Không tìm thấy mẫu',
            'sample_not_found',
            null,
        ],
        [
            'ownership-forbidden',
            403,
            'Bạn không có quyền truy cập mẫu này',
            'ownership_forbidden',
            'sample-uuid',
        ],
        [
            'not-found',
            404,
            'Không tìm thấy phiếu kết quả',
            'confidential_concealed',
            'sample-uuid',
        ],
        [
            'confidential-check-failed',
            404,
            'Không tìm thấy phiếu kết quả',
            'confidential_check_failed',
            'sample-uuid',
        ],
        [
            'sample-not-completed',
            400,
            'Mẫu chưa hoàn thành xét nghiệm',
            'sample_not_completed',
            'sample-uuid',
        ],
        [
            'report-not-ready',
            404,
            'Giấy chứng nhận chưa sẵn sàng. Vui lòng liên hệ phòng xét nghiệm',
            'report_not_ready',
            'sample-uuid',
        ],
    ] as const)(
        'maps %s without conversion and audits %s',
        async (reason, status, message, auditReason, resolvedSampleId) => {
            const consoleError = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined)
            mockLoadAuthorizedClientCoA.mockResolvedValue({
                ok: false,
                clientId: 'client-1',
                sampleId: resolvedSampleId,
                reason,
            })
            if (reason === 'sample-not-found') {
                mockAccessLogInsert.mockImplementation(async (entry) => ({
                    data: null,
                    error:
                        entry.sample_id === null
                            ? null
                            : { message: 'sample_id foreign key violation' },
                }))
            }

            const response = await GET(
                createPdfRequest(`203.0.113.${60 + status % 10}`),
            )

            expect(response.status).toBe(status)
            await expect(response.json()).resolves.toEqual({
                error: message,
            })
            expect(mockStorageDownload).not.toHaveBeenCalled()
            expect(mockConvertHtmlToPdf).not.toHaveBeenCalled()
            expect(mockAccessLogInsert).toHaveBeenCalledWith({
                client_id: 'client-1',
                sample_id: resolvedSampleId,
                coa_report_id: null,
                ip_address: `203.0.113.${60 + status % 10}`,
                user_agent: 'Vitest Client',
                success: false,
                failure_reason: auditReason,
            })
            if (reason === 'confidential-check-failed') {
                expect(consoleError).toHaveBeenCalledWith(
                    'Client CoA PDF operational failure',
                    expect.objectContaining({
                        reasonCode: 'confidential_check_failed',
                        traceId: expect.stringMatching(
                            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
                        ),
                    }),
                )
            } else {
                expect(consoleError).not.toHaveBeenCalled()
            }
            expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
                'public-token',
            )
            expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
                'sample-uuid',
            )
            consoleError.mockRestore()
        },
    )

    it('fails closed when an access-failure audit cannot be persisted', async () => {
        mockLoadAuthorizedClientCoA.mockResolvedValue({
            ok: false,
            clientId: 'client-1',
            sampleId: 'sample-uuid',
            reason: 'ownership-forbidden',
        })
        mockAccessLogInsert.mockResolvedValue({
            data: null,
            error: { message: 'sensitive database error public-token' },
        })
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)

        const response = await GET(createPdfRequest('203.0.113.79'))

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toEqual({
            error:
                'Không thể hoàn tất tải PDF lúc này. Vui lòng thử lại sau.',
        })
        expect(mockConvertHtmlToPdf).not.toHaveBeenCalled()
        expect(consoleError).toHaveBeenCalledWith(
            'Client CoA PDF operational failure',
            expect.objectContaining({
                reasonCode: 'audit_unavailable',
                traceId: expect.stringMatching(
                    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
                ),
            }),
        )
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            'public-token',
        )
        consoleError.mockRestore()
    })
})
