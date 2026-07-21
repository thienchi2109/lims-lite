import { describe, expect, it } from 'vitest'
import {
    CreateSampleSchema,
    CreateSampleWithAssignmentsSchema,
    ResultWithAssaySchema,
    SampleDataSchema,
    SampleSchema,
    UpdateSampleSchema,
} from './lab'

const persistedSample = {
    id: '11111111-1111-4111-8111-111111111111',
    sample_id: 'S-2026-0001',
    client_id: '22222222-2222-4222-8222-222222222222',
    client_name: 'Nguyen Van A',
    type: 'Máu',
    status: 'received',
    received_at: '2026-07-20T08:30:00.000Z',
    received_by: '33333333-3333-4333-8333-333333333333',
    created_at: '2026-07-20T08:30:00.000Z',
    updated_at: '2026-07-20T08:30:00.000Z',
    deleted_at: null,
    rejection_reason: null,
    rejected_at: null,
    rejected_by: null,
}

const createSample = {
    client_id: '22222222-2222-4222-8222-222222222222',
    client_name: 'Nguyen Van A',
    type: 'Máu',
}

describe('sample quality domain contract', () => {
    it('preserves nullable quality on persisted samples', () => {
        const parsed = SampleSchema.parse({
            ...persistedSample,
            sample_quality: null,
        })

        expect(parsed.sample_quality).toBeNull()
    })

    it.each([
        ['CreateSampleSchema', CreateSampleSchema, createSample],
        [
            'CreateSampleWithAssignmentsSchema',
            CreateSampleWithAssignmentsSchema,
            {
                ...createSample,
                tests: [{
                    assayId: '44444444-4444-4444-8444-444444444444',
                    methodId: null,
                }],
            },
        ],
    ])('%s requires quality while accepting false', (_name, schema, payload) => {
        expect(schema.safeParse(payload).success).toBe(false)
        expect(schema.safeParse({ ...payload, sample_quality: false }).success).toBe(true)
    })

    it('keeps quality outside the generic sample update contract', () => {
        expect(UpdateSampleSchema.shape).not.toHaveProperty('sample_quality')
    })

    it.each([
        ['ResultWithAssaySchema', ResultWithAssaySchema],
        ['SampleDataSchema', SampleDataSchema],
    ])('%s requires nullable persisted quality', (_name, schema) => {
        const sampleQualitySchema = schema.shape.sample_quality

        expect(sampleQualitySchema.safeParse(true).success).toBe(true)
        expect(sampleQualitySchema.safeParse(false).success).toBe(true)
        expect(sampleQualitySchema.safeParse(null).success).toBe(true)
        expect(sampleQualitySchema.safeParse(undefined).success).toBe(false)
    })
})
