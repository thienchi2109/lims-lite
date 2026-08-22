import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

async function loadContracts() {
  const filePath = join(process.cwd(), 'src/types/client-lifecycle.ts')
  expect(existsSync(filePath)).toBe(true)
  if (!existsSync(filePath)) return null
  return import('./client-lifecycle')
}

describe('client lifecycle contracts', () => {
  it('parses masked manager-list rows and lifecycle counts', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    const result = contracts.ClientLifecycleManagerDataSchema.safeParse({
      clients: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Nguyễn Văn A',
          dateOfBirth: '1990-01-01',
          gender: 'Nam',
          maskedIdentity: '********9012',
          maskedPhone: '******7890',
          status: 'active',
          deletedAt: null,
          deletionReason: null,
          updatedAt: '2026-08-22T04:00:00+00:00',
          sampleCount: 3,
          collisionReasons: ['government_identity', 'restricted'],
          collisionCandidates: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Trần Thị B',
              maskedIdentity: '********3456',
              maskedPhone: '******4321',
              status: 'inactive',
              updatedAt: '2026-08-22T04:05:00+00:00',
              evidenceLevel: 'trusted',
              collisionReasons: ['government_identity'],
            },
          ],
        },
      ],
      total: 1,
      activeCount: 1,
      inactiveCount: 0,
      collisionCount: 1,
    })

    expect(result.success).toBe(true)
  })

  it('keeps restricted evidence out of collision candidates', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    expect(contracts.ClientCollisionReasonSchema.safeParse('legacy_identity').success)
      .toBe(true)
    expect(contracts.ClientCollisionReasonSchema.safeParse('restricted').success)
      .toBe(true)
    expect(
      contracts.ClientCollisionCandidateSchema.safeParse({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Trần Thị B',
        maskedIdentity: '********3456',
        maskedPhone: '******4321',
        status: 'inactive',
        updatedAt: '2026-08-22T04:05:00+00:00',
        evidenceLevel: 'trusted',
        collisionReasons: ['restricted'],
      }).success,
    ).toBe(false)
  })

  it('requires a meaningful reason for lifecycle mutations', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    expect(
      contracts.DeactivateClientSchema.safeParse({
        clientId: '11111111-1111-4111-8111-111111111111',
        expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
        reason: 'ngắn',
      }).success,
    ).toBe(false)
    expect(
      contracts.RestoreClientSchema.safeParse({
        clientId: '11111111-1111-4111-8111-111111111111',
        expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
        reason: 'Khôi phục theo hồ sơ đã xác minh',
      }).success,
    ).toBe(true)
  })

  it('rejects invalid correction identity and placeholder phone values', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    const base = {
      clientId: '11111111-1111-4111-8111-111111111111',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      name: 'Nguyễn Văn A',
      dateOfBirth: '1990-01-01',
      gender: 'Nam',
      reason: 'Hiệu chỉnh theo giấy tờ gốc',
    }

    expect(
      contracts.CorrectClientIdentitySchema.safeParse({
        ...base,
        idCardNum: 'BACKFILL-1',
        phone: '0000000000',
      }).success,
    ).toBe(false)
    expect(
      contracts.CorrectClientIdentitySchema.safeParse({
        ...base,
        idCardNum: '079203009012',
        phone: '0901234567',
      }).success,
    ).toBe(true)
  })

  it('validates collision adjudication payloads and results', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    const payload = {
      clientId: '11111111-1111-4111-8111-111111111111',
      relatedClientId: '22222222-2222-4222-8222-222222222222',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      relatedExpectedUpdatedAt: '2026-08-22T04:05:00.000Z',
      collisionType: 'phone',
      disposition: 'confirmed_distinct',
      reason: 'Hai hồ sơ thuộc hai khách hàng khác nhau',
    }

    expect(contracts.AdjudicateClientCollisionSchema.safeParse(payload).success)
      .toBe(true)
    expect(
      contracts.AdjudicateClientCollisionSchema.safeParse({
        ...payload,
        collisionType: 'government_identity',
      }).success,
    ).toBe(false)
    expect(
      contracts.AdjudicateClientCollisionSchema.safeParse({
        ...payload,
        collisionType: 'government_identity',
        disposition: 'correction_required',
      }).success,
    ).toBe(true)
    expect(
      contracts.ClientCollisionAdjudicationResultSchema.safeParse({
        id: payload.clientId,
        relatedClientId: payload.relatedClientId,
        collisionType: 'government_identity',
        disposition: 'correction_required',
        adjudicatedAt: '2026-08-22T04:10:00.000Z',
      }).success,
    ).toBe(true)
  })
})
