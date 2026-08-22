import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getSamples: vi.fn(),
    updateSample: vi.fn(),
    createSample: vi.fn(),
    accessionAndAssignTests: vi.fn(),
    recordSampleLabelPrint: vi.fn(),
    globalSearch: vi.fn(),
    configureManagerOtpEmail: vi.fn(),
    getMaskedManagerOtpEmail: vi.fn(),
    createAssayDefinition: vi.fn(),
    updateAssayDefinition: vi.fn(),
    getMethodNameSuggestions: vi.fn(),
    getAssaySampleTypeCatalogManager: vi.fn(),
    getPublishedAssaySampleTypeCatalog: vi.fn(),
    cloneAssaySampleTypeCatalogRevision: vi.fn(),
    updateAssaySampleTypeCatalogReview: vi.fn(),
    reviewAssaySampleTypeCatalogRevision: vi.fn(),
    publishAssaySampleTypeCatalogRevision: vi.fn(),
    createClient: vi.fn(),
    updateUser: vi.fn(),
    getSampleSubmissionReview: vi.fn(),
    approveResults: vi.fn(),
    resolveClientIdentityV2: vi.fn(),
    resolveOrCreateClientV2: vi.fn(),
    findClientByIdentityWithShadow: vi.fn(),
    upsertClientWithShadow: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

vi.mock('@/app/actions/samples', () => ({
    getSamples: (...args: unknown[]) => mocks.getSamples(...args),
    updateSample: (...args: unknown[]) => mocks.updateSample(...args),
    createSample: (...args: unknown[]) => mocks.createSample(...args),
    accessionAndAssignTests: (...args: unknown[]) => mocks.accessionAndAssignTests(...args),
    recordSampleLabelPrint: (...args: unknown[]) => mocks.recordSampleLabelPrint(...args),
}))

vi.mock('@/app/actions/sample-tests', () => ({
    assignTests: vi.fn(),
    getSampleTests: vi.fn(),
}))

vi.mock('@/app/actions/sample-approvals', () => ({
    getSamplesForApprovalCount: vi.fn(),
    getRejectedSamplesCount: vi.fn(),
    getSamplesWithTab: vi.fn(),
    submitSampleForReview: vi.fn(),
    rejectSample: vi.fn(),
    discardSample: vi.fn(),
}))

vi.mock('@/app/actions/results', () => ({
    getResultsBySample: vi.fn(),
    saveBatchResults: vi.fn(),
}))

vi.mock('@/app/actions/submission-reviews', () => ({
    getSampleSubmissionReview: (...args: unknown[]) =>
        mocks.getSampleSubmissionReview(...args),
}))

vi.mock('@/app/actions/results-approval', () => ({
    approveResults: (...args: unknown[]) => mocks.approveResults(...args),
    cancelApproval: vi.fn(),
}))

vi.mock('@/app/actions/assay-queries', () => ({
    getAssayDefinitions: vi.fn(),
}))

vi.mock('@/app/actions/assay-lookups', () => ({
    getMethods: vi.fn(),
    getMethodNameSuggestions: (...args: unknown[]) => mocks.getMethodNameSuggestions(...args),
}))

vi.mock('@/app/actions/assay-mutations', () => ({
    createAssayDefinition: (...args: unknown[]) => mocks.createAssayDefinition(...args),
    updateAssayDefinition: (...args: unknown[]) => mocks.updateAssayDefinition(...args),
    deleteAssayDefinition: vi.fn(),
}))

vi.mock('@/app/actions/assay-sample-type-compatibility', () => ({
    getAssaySampleTypeCatalogManager: (...args: unknown[]) =>
        mocks.getAssaySampleTypeCatalogManager(...args),
    getPublishedAssaySampleTypeCatalog: (...args: unknown[]) =>
        mocks.getPublishedAssaySampleTypeCatalog(...args),
    cloneAssaySampleTypeCatalogRevision: (...args: unknown[]) =>
        mocks.cloneAssaySampleTypeCatalogRevision(...args),
    updateAssaySampleTypeCatalogReview: (...args: unknown[]) =>
        mocks.updateAssaySampleTypeCatalogReview(...args),
    reviewAssaySampleTypeCatalogRevision: (...args: unknown[]) =>
        mocks.reviewAssaySampleTypeCatalogRevision(...args),
    publishAssaySampleTypeCatalogRevision: (...args: unknown[]) =>
        mocks.publishAssaySampleTypeCatalogRevision(...args),
}))

vi.mock('@/app/actions/assay-methods', () => ({
    addMethodToAssay: vi.fn(),
    setDefaultMethod: vi.fn(),
    removeMethodFromAssay: vi.fn(),
}))

vi.mock('@/app/actions/users', () => ({
    createUser: vi.fn(),
    updateUser: (...args: unknown[]) => mocks.updateUser(...args),
    deleteUser: vi.fn(),
}))

vi.mock('@/app/actions/users-manager-otp', () => ({
    configureManagerOtpEmail: (...args: unknown[]) => mocks.configureManagerOtpEmail(...args),
    getMaskedManagerOtpEmail: (...args: unknown[]) => mocks.getMaskedManagerOtpEmail(...args),
}))

vi.mock('@/app/actions/clients', () => ({
    upsertClient: vi.fn(),
    findClientByIdentity: vi.fn(),
    getClient: vi.fn(),
    getClients: vi.fn(),
    updateClient: vi.fn(),
}))

vi.mock('./client-resolution-shadow-handlers', () => ({
    findClientByIdentityWithShadow: (...args: unknown[]) =>
        mocks.findClientByIdentityWithShadow(...args),
    upsertClientWithShadow: (...args: unknown[]) =>
        mocks.upsertClientWithShadow(...args),
}))

vi.mock('@/lib/client-resolution/server', () => ({
    resolveClientIdentityV2: (...args: unknown[]) =>
        mocks.resolveClientIdentityV2(...args),
    resolveOrCreateClientV2: (...args: unknown[]) =>
        mocks.resolveOrCreateClientV2(...args),
}))

vi.mock('@/app/actions/signatures', () => ({
    uploadSignature: vi.fn(),
    uploadManagerSignature: vi.fn(),
    getActiveSignature: vi.fn(),
    getSignatureHistory: vi.fn(),
    downloadSignature: vi.fn(),
}))

vi.mock('@/app/actions/search', () => ({
    searchSamples: vi.fn(),
    searchClients: vi.fn(),
    searchAssays: vi.fn(),
    searchResults: vi.fn(),
    searchAuditLogs: vi.fn(),
    globalSearch: (...args: unknown[]) => mocks.globalSearch(...args),
}))

vi.mock('@/app/actions/coa', () => ({
    generateCoA: vi.fn(),
    regenerateCoA: vi.fn(),
}))

import { POST } from './route'

function buildRequest(action: string, payload?: unknown) {
    return new Request('http://localhost/api/client-actions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            origin: 'http://localhost',
        },
        body: JSON.stringify({ action, payload }),
    })
}

function mockRole(role: string) {
    const usersQuery: Record<string, unknown> = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: { role },
            error: null,
        })),
    }

    mocks.createClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'user-1' } },
                error: null,
            }),
        },
        from: (table: string) => {
            expect(table).toBe('users')
            return usersQuery
        },
    })
}

function mockUnauthenticated() {
    mocks.createClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: null },
                error: null,
            }),
        },
    })
}

function mockPasswordOnlyOtpManager() {
    const usersQuery: Record<string, unknown> = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: {
                role: 'manager',
                can_access_confidential: false,
                manager_otp_settings: { updated_at: '2026-07-26T00:00:00.000Z' },
            },
            error: null,
        })),
    }

    mocks.createClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'manager-1' } },
                error: null,
            }),
            getSession: vi.fn().mockResolvedValue({
                data: { session: { access_token: null } },
                error: null,
            }),
        },
        from: () => usersQuery,
    })
}

describe('client action role guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getSamples.mockResolvedValue({ data: [] })
        mocks.updateSample.mockResolvedValue({ data: { id: 'sample-1' } })
        mocks.createSample.mockResolvedValue({ data: { id: 'sample-1' } })
        mocks.accessionAndAssignTests.mockResolvedValue({ data: { sample: { id: 'sample-1' } } })
        mocks.globalSearch.mockResolvedValue({ data: [] })
        mocks.configureManagerOtpEmail.mockResolvedValue({ success: true })
        mocks.getMaskedManagerOtpEmail.mockResolvedValue({ otpEmail: null })
        mocks.createAssayDefinition.mockResolvedValue({ success: true })
        mocks.updateAssayDefinition.mockResolvedValue({ success: true })
        mocks.getMethodNameSuggestions.mockResolvedValue({ data: ['CLIA'] })
        mocks.getSampleSubmissionReview.mockResolvedValue({
            data: { submissions: [] },
        })
        mocks.approveResults.mockResolvedValue({ success: true, approvedCount: 1 })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('allows doctor to call the completed samples read action', async () => {
        mockRole('doctor')

        const response = await POST(buildRequest('getSamples', { status: 'completed' }))

        expect(response.status).toBe(200)
        expect(mocks.getSamples).toHaveBeenCalledWith({ status: 'completed' })
    })

    it('rejects role-bearing update payloads before invoking the Server Action', async () => {
        mockRole('manager')

        const response = await POST(buildRequest('updateUser', {
            id: '11111111-1111-4111-8111-111111111111',
            role: 'manager',
        }))

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual(
            expect.objectContaining({ error: expect.stringMatching(/role|vai trò/i) }),
        )
        expect(mocks.updateUser).not.toHaveBeenCalled()
    })

    it('denies doctor sample mutation actions before the handler runs', async () => {
        mockRole('doctor')

        const response = await POST(buildRequest('updateSample', { id: 'sample-1' }))

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({
            error: 'Bạn không có quyền thực hiện thao tác này',
        })
        expect(mocks.updateSample).not.toHaveBeenCalled()
    })

    it.each([
        'resolveClientIdentityV2',
        'resolveOrCreateClientV2',
    ] as const)(
        'denies unauthenticated %s requests before the resolver runs',
        async (action) => {
            mockUnauthenticated()

            const response = await POST(buildRequest(action, {}))

            expect(response.status).toBe(403)
            await expect(response.json()).resolves.toEqual({
                error: 'Bạn không có quyền thực hiện thao tác này',
            })
            expect(mocks[action]).not.toHaveBeenCalled()
        },
    )

    it.each([
        'resolveClientIdentityV2',
        'resolveOrCreateClientV2',
    ] as const)(
        'denies doctor %s requests before the resolver runs',
        async (action) => {
            mockRole('doctor')

            const response = await POST(buildRequest(action, {}))

            expect(response.status).toBe(403)
            expect(mocks[action]).not.toHaveBeenCalled()
        },
    )

    it.each([
        ['analyst', 'resolveClientIdentityV2'],
        ['manager', 'resolveOrCreateClientV2'],
    ] as const)(
        'allows %s to dispatch %s',
        async (role, action) => {
            mockRole(role)
            mocks[action].mockResolvedValue({ data: { outcome: 'not_found' } })

            const response = await POST(buildRequest(action, {}))

            expect(response.status).toBe(200)
            expect(mocks[action]).toHaveBeenCalledWith({})
        },
    )

    it('denies approveResults before the privileged handler when manager OTP is missing', async () => {
        vi.stubEnv('MANAGER_EMAIL_OTP_ENABLED', 'TRUE')
        vi.stubEnv('MANAGER_HIV_EMAIL_OTP_ENABLED', 'FALSE')
        vi.stubEnv('ANALYST_HIV_EMAIL_OTP_ENABLED', 'FALSE')
        vi.stubEnv('MANAGER_OTP_STEP_UP_SECRET', 'route-test-step-up-secret')
        mockPasswordOnlyOtpManager()

        const response = await POST(buildRequest('approveResults', {
            sampleId: '11111111-1111-4111-8111-111111111111',
            resultIds: ['22222222-2222-4222-8222-222222222222'],
        }))

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({
            error: 'Yêu cầu xác thực OTP email quản lý trước khi tiếp tục',
        })
        expect(mocks.approveResults).not.toHaveBeenCalled()
    })

    it('denies doctor global search before the handler runs', async () => {
        mockRole('doctor')

        const response = await POST(buildRequest('globalSearch', { query: 'ABC' }))

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({
            error: 'Bạn không có quyền thực hiện thao tác này',
        })
        expect(mocks.globalSearch).not.toHaveBeenCalled()
    })

    it('denies manager sample creation before the handler runs', async () => {
        mockRole('manager')

        const response = await POST(buildRequest('createSample', { client_id: 'sample-1' }))

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({
            error: 'Bạn không có quyền thực hiện thao tác này',
        })
        expect(mocks.createSample).not.toHaveBeenCalled()
    })

    it('denies manager accession before the handler runs', async () => {
        mockRole('manager')

        const response = await POST(buildRequest('accessionAndAssignTests', { client_id: 'sample-1', tests: [] }))

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({
            error: 'Bạn không có quyền thực hiện thao tác này',
        })
        expect(mocks.accessionAndAssignTests).not.toHaveBeenCalled()
    })

    it('rejects invalid manager OTP email payload before calling the action', async () => {
        mocks.createClient.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: null },
                    error: null,
                }),
            },
        })

        const response = await POST(buildRequest('configureManagerOtpEmail', {
            userId: 'not-a-uuid',
            otpEmail: 'not-an-email',
        }))

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: 'ID người dùng không hợp lệ' })
        expect(mocks.configureManagerOtpEmail).not.toHaveBeenCalled()
    })

    it('passes manager assay methodName as assay-owned method_name form data', async () => {
        mockRole('manager')

        const response = await POST(buildRequest('createAssayDefinition', {
            name: 'Anti HCV',
            methodName: 'CLIA',
            importCode: 'CT-999999',
        }))

        expect(response.status).toBe(200)
        expect(mocks.createAssayDefinition).toHaveBeenCalledTimes(1)
        const formData = mocks.createAssayDefinition.mock.calls[0][0] as FormData
        expect(formData.get('method_name')).toBe('CLIA')
        expect(formData.has('method_id')).toBe(false)
        expect(formData.has('import_code')).toBe(false)
    })

    it('dispatches manager compatibility review without derived publication fields', async () => {
        mockRole('manager')
        mocks.updateAssaySampleTypeCatalogReview.mockResolvedValue({ success: true })

        const payload = {
            revisionId: '11111111-1111-4111-8111-111111111111',
            assayDefinitionId: '22222222-2222-4222-8222-222222222222',
            disposition: 'configured',
            reviewReason: 'Đã đối chiếu SOP',
            sampleTypeIds: ['33333333-3333-4333-8333-333333333333'],
            candidateDecisions: [],
            expectedRevisionUpdatedAt: '2026-08-20T08:00:00.000Z',
        }
        const response = await POST(buildRequest(
            'updateAssaySampleTypeCatalogReview',
            payload,
        ))

        expect(response.status).toBe(200)
        expect(mocks.updateAssaySampleTypeCatalogReview).toHaveBeenCalledWith(payload)
    })

    it('denies analyst access to manager compatibility actions', async () => {
        mockRole('analyst')

        const response = await POST(buildRequest(
            'cloneAssaySampleTypeCatalogRevision',
            {
                sourceRevisionNumber: 1,
                creationReason: 'Chuẩn bị revision hiệu chỉnh',
            },
        ))

        expect(response.status).toBe(403)
        expect(mocks.cloneAssaySampleTypeCatalogRevision).not.toHaveBeenCalled()
    })

    it('allows analysts to read the published compatibility catalog', async () => {
        mockRole('analyst')
        const catalogResponse = {
            data: {
                revisionNumber: 7,
                sampleTypeId: null,
                sampleTypes: [{
                    id: '11111111-1111-4111-8111-111111111111',
                    importCode: 'LM-000001',
                    name: 'Máu',
                }],
                assays: [],
            },
        }
        mocks.getPublishedAssaySampleTypeCatalog.mockResolvedValue(catalogResponse)

        const response = await POST(buildRequest(
            'getPublishedAssaySampleTypeCatalog',
            {},
        ))

        expect(response.status).toBe(200)
        expect(mocks.getPublishedAssaySampleTypeCatalog).toHaveBeenCalledWith({})
        await expect(response.json()).resolves.toEqual(catalogResponse)
    })

    it('passes manager assay reference range as normal_range form data', async () => {
        mockRole('manager')

        const response = await POST(buildRequest('createAssayDefinition', {
            name: 'Creatinine',
            normalRange: 'Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L',
        }))

        expect(response.status).toBe(200)
        expect(mocks.createAssayDefinition).toHaveBeenCalledTimes(1)
        const formData = mocks.createAssayDefinition.mock.calls[0][0] as FormData
        expect(formData.get('normal_range')).toBe('Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L')
    })

    it('passes manager assay update methodName as assay-owned method_name form data', async () => {
        mockRole('manager')

        const response = await POST(buildRequest('updateAssayDefinition', {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Anti HCV',
            methodName: 'ELISA',
            importCode: 'CT-999999',
        }))

        expect(response.status).toBe(200)
        expect(mocks.updateAssayDefinition).toHaveBeenCalledTimes(1)
        const formData = mocks.updateAssayDefinition.mock.calls[0][0] as FormData
        expect(formData.get('method_name')).toBe('ELISA')
        expect(formData.has('import_code')).toBe(false)
    })

    it('passes blank manager assay update reference range so the server can clear it', async () => {
        mockRole('manager')

        const response = await POST(buildRequest('updateAssayDefinition', {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Creatinine',
            normalRange: '',
        }))

        expect(response.status).toBe(200)
        expect(mocks.updateAssayDefinition).toHaveBeenCalledTimes(1)
        const formData = mocks.updateAssayDefinition.mock.calls[0][0] as FormData
        expect(formData.has('normal_range')).toBe(true)
        expect(formData.get('normal_range')).toBe('')
    })

    it('dispatches method name suggestion lookup through the client-action bridge', async () => {
        mockRole('manager')

        const response = await POST(buildRequest('getMethodNameSuggestions'))

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ data: ['CLIA'] })
        expect(mocks.getMethodNameSuggestions).toHaveBeenCalledTimes(1)
    })

    it('dispatches manager submission review reads through the client-action bridge', async () => {
        mockRole('manager')
        const sampleId = '11111111-1111-4111-8111-111111111111'

        const response = await POST(
            buildRequest('getSampleSubmissionReview', { sampleId }),
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            data: { submissions: [] },
        })
        expect(mocks.getSampleSubmissionReview).toHaveBeenCalledWith(sampleId)
    })
})
