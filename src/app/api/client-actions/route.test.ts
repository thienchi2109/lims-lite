import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getSamples: vi.fn(),
    updateSample: vi.fn(),
    createSample: vi.fn(),
    accessionAndAssignTests: vi.fn(),
    recordSampleLabelPrint: vi.fn(),
    globalSearch: vi.fn(),
    createClient: vi.fn(),
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

vi.mock('@/app/actions/results-approval', () => ({
    approveResults: vi.fn(),
    cancelApproval: vi.fn(),
}))

vi.mock('@/app/actions/assay-queries', () => ({
    getAssayDefinitions: vi.fn(),
}))

vi.mock('@/app/actions/assay-lookups', () => ({
    getMethods: vi.fn(),
}))

vi.mock('@/app/actions/assay-mutations', () => ({
    createAssayDefinition: vi.fn(),
    updateAssayDefinition: vi.fn(),
    deleteAssayDefinition: vi.fn(),
}))

vi.mock('@/app/actions/assay-methods', () => ({
    addMethodToAssay: vi.fn(),
    setDefaultMethod: vi.fn(),
    removeMethodFromAssay: vi.fn(),
}))

vi.mock('@/app/actions/users', () => ({
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
}))

vi.mock('@/app/actions/clients', () => ({
    upsertClient: vi.fn(),
    findClientByIdentity: vi.fn(),
    getClient: vi.fn(),
    getClients: vi.fn(),
    updateClient: vi.fn(),
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

describe('client action role guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getSamples.mockResolvedValue({ data: [] })
        mocks.updateSample.mockResolvedValue({ data: { id: 'sample-1' } })
        mocks.createSample.mockResolvedValue({ data: { id: 'sample-1' } })
        mocks.accessionAndAssignTests.mockResolvedValue({ data: { sample: { id: 'sample-1' } } })
        mocks.globalSearch.mockResolvedValue({ data: [] })
    })

    it('allows doctor to call the completed samples read action', async () => {
        mockRole('doctor')

        const response = await POST(buildRequest('getSamples', { status: 'completed' }))

        expect(response.status).toBe(200)
        expect(mocks.getSamples).toHaveBeenCalledWith({ status: 'completed' })
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
})
