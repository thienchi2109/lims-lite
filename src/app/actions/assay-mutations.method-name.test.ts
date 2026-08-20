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
            import_code: 'CT-000001',
            name: 'Anti HCV',
            method_name: 'CLIA',
        })
        const from = vi.fn().mockReturnValue(insertChain)
        mockCreateClient.mockResolvedValue({ from })

        const formData = new FormData()
        formData.set('name', 'Anti HCV')
        formData.set('method_name', 'CLIA')
        formData.set('import_code', 'CT-999999')

        const result = await createAssayDefinition(formData)

        expect(result).toEqual({
            success: true,
            data: expect.objectContaining({
                import_code: 'CT-000001',
                method_name: 'CLIA',
            }),
        })
        expect(from).toHaveBeenCalledTimes(1)
        expect(from).toHaveBeenCalledWith('assay_definitions')
        expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ method_name: 'CLIA' }))
        expect(insertChain.insert.mock.calls[0][0]).not.toHaveProperty('import_code')
    })

    it('creates an assay definition with reference range text', async () => {
        const insertChain = createInsertChain({
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Creatinine',
            normal_range: 'Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L',
        })
        mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(insertChain) })

        const formData = new FormData()
        formData.set('name', 'Creatinine')
        formData.set('normal_range', 'Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L')

        const result = await createAssayDefinition(formData)

        expect(result).toEqual({
            success: true,
            data: expect.objectContaining({
                normal_range: 'Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L',
            }),
        })
        expect(insertChain.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                normal_range: 'Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L',
            }),
        )
    })

    it('updates assay-owned method_name on assay_definitions', async () => {
        const updateChain = createUpdateChain({
            id: '11111111-1111-4111-8111-111111111111',
            import_code: 'CT-000001',
            name: 'Anti HCV',
            method_name: 'ELISA',
        })
        mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(updateChain) })

        const formData = new FormData()
        formData.set('id', '11111111-1111-4111-8111-111111111111')
        formData.set('name', 'Anti HCV')
        formData.set('method_name', 'ELISA')
        formData.set('import_code', 'CT-999999')

        const result = await updateAssayDefinition(formData)

        expect(result).toEqual({
            success: true,
            data: expect.objectContaining({
                import_code: 'CT-000001',
                method_name: 'ELISA',
            }),
        })
        expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ method_name: 'ELISA' }))
        expect(updateChain.update.mock.calls[0][0]).not.toHaveProperty('import_code')
    })

    it('updates reference range text on assay_definitions', async () => {
        const updateChain = createUpdateChain({
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Creatinine',
            normal_range: 'Âm tính',
        })
        mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(updateChain) })

        const formData = new FormData()
        formData.set('id', '11111111-1111-4111-8111-111111111111')
        formData.set('name', 'Creatinine')
        formData.set('normal_range', 'Âm tính')

        const result = await updateAssayDefinition(formData)

        expect(result).toEqual({
            success: true,
            data: expect.objectContaining({ normal_range: 'Âm tính' }),
        })
        expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ normal_range: 'Âm tính' }))
    })

    it('clears reference range text to null when submitted blank', async () => {
        const updateChain = createUpdateChain({
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Creatinine',
            normal_range: null,
        })
        mockCreateClient.mockResolvedValue({ from: vi.fn().mockReturnValue(updateChain) })

        const formData = new FormData()
        formData.set('id', '11111111-1111-4111-8111-111111111111')
        formData.set('name', 'Creatinine')
        formData.set('normal_range', '   ')

        await updateAssayDefinition(formData)

        expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ normal_range: null }))
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

    it('rejects non-manager reference range updates before database writes', async () => {
        mockRequireRole.mockResolvedValue({ error: 'Forbidden' })
        const from = vi.fn()
        mockCreateClient.mockResolvedValue({ from })

        const formData = new FormData()
        formData.set('id', '11111111-1111-4111-8111-111111111111')
        formData.set('name', 'Creatinine')
        formData.set('normal_range', 'Âm tính')

        await expect(updateAssayDefinition(formData)).resolves.toEqual({
            error: 'Chỉ Quản lý mới có thể cập nhật chỉ tiêu xét nghiệm',
        })
        expect(from).not.toHaveBeenCalled()
    })
})
