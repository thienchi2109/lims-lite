import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type Schema = {
  safeParse: (value: unknown) => {
    success: boolean
    data?: unknown
  }
}

type ContractModule = Record<string, Schema>

async function loadContracts() {
  const filePath = join(
    process.cwd(),
    'src/types/assay-sample-type-compatibility.ts',
  )
  expect(existsSync(filePath)).toBe(true)
  if (!existsSync(filePath)) return null

  const modulePath = './' + 'assay-sample-type-compatibility'
  return import(modulePath) as Promise<ContractModule>
}

describe('assay sample-type compatibility contracts', () => {
  it('accepts the manager-owned review payload', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    const result = contracts.UpdateAssaySampleTypeCatalogReviewSchema.safeParse({
      revisionId: '11111111-1111-4111-8111-111111111111',
      assayDefinitionId: '22222222-2222-4222-8222-222222222222',
      disposition: 'configured',
      reviewReason: 'Đã đối chiếu SOP chuyên môn',
      sampleTypeIds: ['33333333-3333-4333-8333-333333333333'],
      candidateDecisions: [{
        candidateId: '44444444-4444-4444-8444-444444444444',
        decision: 'accepted',
        reason: 'Phù hợp hồ sơ lịch sử và SOP',
      }],
      expectedRevisionUpdatedAt: '2026-08-20T08:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })

  it('accepts manager catalog lifecycle state for assays and sample types', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    const result = contracts.AssaySampleTypeCatalogManagerSchema.safeParse({
      revision: null,
      diff: {
        addedPairCount: 0,
        removedPairCount: 0,
        changedReviewCount: 0,
      },
      sampleTypes: [{
        id: '33333333-3333-4333-8333-333333333333',
        importCode: 'LM-000001',
        name: 'Huyết thanh',
        compatibilityGeneration: 2,
        isActive: false,
      }],
      assays: [{
        assayDefinitionId: '22222222-2222-4222-8222-222222222222',
        importCode: 'XN-000001',
        name: 'Glucose',
        methodName: null,
        specialtyId: null,
        compatibilityGeneration: 3,
        isActive: false,
        disposition: 'not_assignable',
        reviewReason: 'Chỉ tiêu đã ngưng hoạt động',
        compatibilities: [],
        candidates: [],
      }],
    })

    expect(result.success).toBe(true)
  })

  it('rejects server-owned actor, code, hash, and publication state', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    for (const forbiddenField of [
      'actorId',
      'importCode',
      'contentHash',
      'status',
      'publishedBy',
    ]) {
      const result = contracts.PublishAssaySampleTypeCatalogRevisionSchema.safeParse({
        revisionId: '11111111-1111-4111-8111-111111111111',
        expectedRevisionUpdatedAt: '2026-08-20T08:00:00.000Z',
        publishReason: 'Phê duyệt theo SOP',
        [forbiddenField]: 'forbidden',
      })
      expect(result.success).toBe(false)
    }
  })

  it('requires configured reviews to select sample types and not-assignable reviews to select none', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    const base = {
      revisionId: '11111111-1111-4111-8111-111111111111',
      assayDefinitionId: '22222222-2222-4222-8222-222222222222',
      reviewReason: 'Đã đối chiếu SOP chuyên môn',
      candidateDecisions: [],
      expectedRevisionUpdatedAt: '2026-08-20T08:00:00.000Z',
    }

    expect(
      contracts.UpdateAssaySampleTypeCatalogReviewSchema.safeParse({
        ...base,
        disposition: 'configured',
        sampleTypeIds: [],
      }).success,
    ).toBe(false)
    expect(
      contracts.UpdateAssaySampleTypeCatalogReviewSchema.safeParse({
        ...base,
        disposition: 'not_assignable',
        sampleTypeIds: ['33333333-3333-4333-8333-333333333333'],
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate sample types and candidate decisions', async () => {
    const contracts = await loadContracts()
    if (!contracts) return

    const result = contracts.UpdateAssaySampleTypeCatalogReviewSchema.safeParse({
      revisionId: '11111111-1111-4111-8111-111111111111',
      assayDefinitionId: '22222222-2222-4222-8222-222222222222',
      disposition: 'configured',
      reviewReason: 'Đã đối chiếu SOP chuyên môn',
      sampleTypeIds: [
        '33333333-3333-4333-8333-333333333333',
        '33333333-3333-4333-8333-333333333333',
      ],
      candidateDecisions: [
        {
          candidateId: '44444444-4444-4444-8444-444444444444',
          decision: 'accepted',
          reason: 'Đã xác nhận',
        },
        {
          candidateId: '44444444-4444-4444-8444-444444444444',
          decision: 'rejected',
          reason: 'Đã loại',
        },
      ],
      expectedRevisionUpdatedAt: '2026-08-20T08:00:00.000Z',
    })

    expect(result.success).toBe(false)
  })
})
