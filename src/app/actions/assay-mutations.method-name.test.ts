import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockRequireRole = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: (value: unknown) => Boolean(value && typeof value === 'object' && 'error' in value),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { createAssayDefinition, updateAssayDefinition } from './assay-mutations'

function createInsertChain(data: Record<string, unknown>) {
    return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data, error: null }),
    }
}

function createUpdateChain(data: Record<string, unknown>) {
    return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data, error: null }),
    }
}

describe('assay mutation method text persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRequireRole.mockResolvedValue({ user: { id: 'manager-1' }, role: 'manager' })
    })

    it('creates an assay definition with assay-owned method_name without requiring assay_methods', async () => {
        const insertChain = createInsertChain({
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Anti HCV',
            method_name: 'CLIA',
        })
        const from = vi.fn().mockReturnValue(insertChain)
        mockCreateClient.mockResolvedValue({ from })

        const formData = new FormData()
        formData.set('name', 'Anti HCV')
        formData.set('method_name', 'CLIA')

        const result = await createAssayDefinition(formData)

        expect(result).toEqual({
            success: true,
            data: expect.objectContaining({ method_name: 'CLIA' }),
        })
        expect(from).toHaveBeenCalledTimes(1)
        expect(from).toHaveBeenCalledWith('assay_definitions')
        expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ method_name: 'CLIA' }))
    })

    it('updates assay-owned method_name on assay_definitions', async () => {
        const updateChain = createUpdateChain({
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Anti HCV',
            method_name: 'ELISA',
        })
        mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(updateChain) })

        const formData = new FormData()
        formData.set('id', '11111111-1111-4111-8111-111111111111')
        formData.set('name', 'Anti HCV')
        formData.set('method_name', 'ELISA')

        const result = await updateAssayDefinition(formData)

        expect(result).toEqual({
            success: true,
            data: expect.objectContaining({ method_name: 'ELISA' }),
        })
        expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ method_name: 'ELISA' }))
    })

    it('does not clear method_name when legacy edit forms omit it', async () => {
        const updateChain = createUpdateChain({
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Anti HCV',
        })
        mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(updateChain) })

        const formData = new FormData()
        formData.set('id', '11111111-1111-4111-8111-111111111111')
        formData.set('name', 'Anti HCV')

        await updateAssayDefinition(formData)

        const updatePayload = updateChain.update.mock.calls[0][0]
        expect(updatePayload).not.toHaveProperty('method_name')
    })
})
