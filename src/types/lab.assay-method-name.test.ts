import { describe, expect, it } from 'vitest'
import { CreateAssayDefinitionSchema } from './lab'

describe('assay definition method text schema', () => {
    it('keeps assay-owned method_name for create payloads', () => {
        const result = CreateAssayDefinitionSchema.safeParse({
            name: 'Anti HCV',
            method_name: 'CLIA',
            units: 'S/CO',
        })

        expect(result.success).toBe(true)
        expect(result.success && result.data.method_name).toBe('CLIA')
    })
})
