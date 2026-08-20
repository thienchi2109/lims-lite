import { describe, expect, it } from 'vitest'
import {
    AssayDefinitionSchema,
    CreateAssayDefinitionSchema,
} from './lab'

const assayDefinition = {
    id: '11111111-1111-4111-8111-111111111111',
    import_code: 'CT-000001',
    name: 'Anti HCV',
    specialty_id: null,
    units: 'S/CO',
    normal_range: null,
    method_name: 'CLIA',
    validation_rules: {},
    is_confidential: false,
    created_at: '2026-08-20T00:00:00.000Z',
    updated_at: '2026-08-20T00:00:00.000Z',
    deleted_at: null,
}

describe('assay import code schemas', () => {
    it('requires a correctly formatted import_code in read models', () => {
        expect(AssayDefinitionSchema.parse(assayDefinition).import_code).toBe('CT-000001')
        expect(() =>
            AssayDefinitionSchema.parse({
                ...assayDefinition,
                import_code: 'ANTI-HCV',
            }),
        ).toThrow()
        expect(() => {
            const withoutImportCode: Partial<typeof assayDefinition> = {
                ...assayDefinition,
            }
            delete withoutImportCode.import_code
            AssayDefinitionSchema.parse(withoutImportCode)
        }).toThrow()
    })

    it('does not carry client-supplied import_code through the create schema', () => {
        const result = CreateAssayDefinitionSchema.parse({
            name: 'Anti HCV',
            method_name: 'CLIA',
            import_code: 'CT-999999',
        })

        expect(result).not.toHaveProperty('import_code')
    })
})
