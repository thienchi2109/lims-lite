import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    readManagerStepUpCookieValue: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

vi.mock('@/lib/manager-email-otp/step-up', () => ({
    getManagerStepUpSecret: () => 'batch-step-up-secret',
    MANAGER_STEP_UP_COOKIE_NAME: 'manager_otp_step_up',
    readManagerStepUpCookieValue: (...args: unknown[]) =>
        mocks.readManagerStepUpCookieValue(...args),
}))

import { getApprovalBatchManager } from './auth'

function createUserClient(role = 'manager') {
    const userQuery = {
        select: vi.fn(() => userQuery),
        eq: vi.fn(() => userQuery),
        single: vi.fn(async () => ({
            data: {
                role,
                can_access_confidential: false,
                manager_otp_settings: {
                    updated_at: '2026-06-01T00:00:00.000Z',
                },
            },
            error: null,
        })),
    }

    return {
        auth: {
            getUser: vi.fn(async () => ({
                data: {
                    user: {
                        id: '11111111-1111-4111-8111-111111111111',
                    },
                },
                error: null,
            })),
            getSession: vi.fn(async () => ({
                data: {
                    session: {
                        access_token: [
                            'header',
                            Buffer.from(JSON.stringify({
                                session_id: 'session-1',
                            })).toString('base64url'),
                            'signature',
                        ].join('.'),
                    },
                },
                error: null,
            })),
        },
        from: vi.fn(() => userQuery),
        rpc: vi.fn(),
    }
}

function createRequest(cookie?: string) {
    return new Request('http://localhost/api/manager/approval-batches', {
        headers: cookie
            ? { cookie: `manager_otp_step_up=${encodeURIComponent(cookie)}` }
            : undefined,
    })
}

describe('approval batch manager authorization', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.createClient.mockResolvedValue(createUserClient())
        mocks.readManagerStepUpCookieValue.mockResolvedValue({
            ok: true,
            payload: {
                userId: '11111111-1111-4111-8111-111111111111',
                sessionId: 'session-1',
                cohort: 'standard',
                otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
                expiresAt: '2026-06-01T04:00:00.000Z',
                authorizationId: '33333333-3333-4333-8333-333333333333',
                verifiedAt: '2026-06-01T00:30:00.000Z',
            },
        })
    })

    it('rejects non-manager roles before database mutation access', async () => {
        mocks.createClient.mockResolvedValue(createUserClient('analyst'))

        await expect(
            getApprovalBatchManager(createRequest(), { requireStepUp: false }),
        ).resolves.toEqual({
            ok: false,
            status: 403,
            error: { code: 'MANAGER_REQUIRED' },
        })
    })

    it('requires current step-up metadata for submit and retry', async () => {
        mocks.readManagerStepUpCookieValue.mockResolvedValue({
            ok: false,
            reason: 'missing',
        })

        await expect(
            getApprovalBatchManager(createRequest(), { requireStepUp: true }),
        ).resolves.toEqual({
            ok: false,
            status: 403,
            error: { code: 'OTP_STEP_UP_REQUIRED' },
        })
    })

    it('returns only server-derived manager and step-up metadata', async () => {
        const result = await getApprovalBatchManager(
            createRequest('signed-step-up-cookie'),
            { requireStepUp: true },
        )

        expect(result).toMatchObject({
            ok: true,
            manager: {
                id: '11111111-1111-4111-8111-111111111111',
                canAccessConfidential: false,
                stepUp: {
                    authorizationId:
                        '33333333-3333-4333-8333-333333333333',
                    verifiedAt: '2026-06-01T00:30:00.000Z',
                    cohort: 'manager_email_otp',
                },
            },
        })
        expect(mocks.readManagerStepUpCookieValue).toHaveBeenCalledWith(
            'signed-step-up-cookie',
            expect.objectContaining({
                userId: '11111111-1111-4111-8111-111111111111',
                sessionId: 'session-1',
                cohort: 'standard',
            }),
        )
    })
})
