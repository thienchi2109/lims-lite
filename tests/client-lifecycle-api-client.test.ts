import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'
import {
  adjudicateClientCollisionClient,
  correctClientIdentityClient,
  deactivateClientClient,
  restoreClientClient,
} from '@/lib/api-client'
import type {
  AdjudicateClientCollision,
  ClientCollisionAdjudicationResult,
  ClientLifecycleMutationResult,
  CorrectClientIdentity,
  DeactivateClient,
  RestoreClient,
} from '@/types'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const actionNames = [
  'getClientLifecycleManager',
  'getClientLifecycleDetailManager',
  'deactivateClient',
  'restoreClient',
  'correctClientIdentity',
  'adjudicateClientCollision',
] as const

describe('client lifecycle API client contracts', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers every lifecycle action in the client-action bridge', () => {
    const actionTypes = read('src/lib/client-actions/types.ts')
    const route = read('src/app/api/client-actions/route.ts')
    const guard = read('src/app/api/client-actions/role-guard.ts')

    for (const actionName of actionNames) {
      expect(actionTypes).toContain(`| '${actionName}'`)
      expect(route).toMatch(new RegExp(`\\b${actionName}\\b`))
      expect(guard).toContain(`'${actionName}'`)
    }
  })

  it('keeps lifecycle mutation wrapper types concrete', () => {
    type MutationResponse = { data: ClientLifecycleMutationResult }

    expectTypeOf(deactivateClientClient)
      .parameter(0)
      .toEqualTypeOf<DeactivateClient>()
    expectTypeOf(deactivateClientClient)
      .returns
      .toEqualTypeOf<Promise<MutationResponse>>()
    expectTypeOf(restoreClientClient)
      .parameter(0)
      .toEqualTypeOf<RestoreClient>()
    expectTypeOf(restoreClientClient)
      .returns
      .toEqualTypeOf<Promise<MutationResponse>>()
    expectTypeOf(correctClientIdentityClient)
      .parameter(0)
      .toEqualTypeOf<CorrectClientIdentity>()
    expectTypeOf(correctClientIdentityClient)
      .returns
      .toEqualTypeOf<Promise<MutationResponse>>()
    expectTypeOf(adjudicateClientCollisionClient)
      .parameter(0)
      .toEqualTypeOf<AdjudicateClientCollision>()
    expectTypeOf(adjudicateClientCollisionClient)
      .returns
      .toEqualTypeOf<Promise<{ data: ClientCollisionAdjudicationResult }>>()
  })

  it.each([
    ['deactivateClient', deactivateClientClient],
    ['restoreClient', restoreClientClient],
  ] as const)('sends %s through the JSON bridge at runtime', async (action, wrapper) => {
    const payload = {
      clientId: '11111111-1111-4111-8111-111111111111',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      reason: 'Thao tác theo hồ sơ đã phê duyệt',
    }
    const response = {
      data: {
        id: payload.clientId,
        status: action === 'deactivateClient' ? 'inactive' : 'active',
        updatedAt: '2026-08-22T04:10:00.000Z',
      },
    }
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(wrapper(payload)).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/client-actions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action, payload }),
      }),
    )
  })

  it('sends correction and adjudication payloads without losing result types', async () => {
    const correctionPayload: CorrectClientIdentity = {
      clientId: '11111111-1111-4111-8111-111111111111',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      idCardNum: '079203009012',
      name: 'Nguyễn Văn A',
      dateOfBirth: '1990-01-01',
      gender: 'Nam',
      phone: '0901234567',
      reason: 'Hiệu chỉnh theo giấy tờ gốc',
    }
    const mutationResponse = {
      data: {
        id: correctionPayload.clientId,
        status: 'active',
        updatedAt: '2026-08-22T04:10:00.000Z',
      },
    }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(mutationResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(correctClientIdentityClient(correctionPayload))
      .resolves.toEqual(mutationResponse)

    const adjudicationPayload: AdjudicateClientCollision = {
      clientId: correctionPayload.clientId,
      relatedClientId: '22222222-2222-4222-8222-222222222222',
      expectedUpdatedAt: correctionPayload.expectedUpdatedAt,
      relatedExpectedUpdatedAt: '2026-08-22T04:05:00.000Z',
      collisionType: 'phone',
      disposition: 'confirmed_distinct',
      reason: 'Hai hồ sơ thuộc hai khách hàng khác nhau',
    }
    const adjudicationResponse = {
      data: {
        id: adjudicationPayload.clientId,
        relatedClientId: adjudicationPayload.relatedClientId,
        collisionType: adjudicationPayload.collisionType,
        disposition: adjudicationPayload.disposition,
        adjudicatedAt: '2026-08-22T04:12:00.000Z',
      },
    }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(adjudicationResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(adjudicateClientCollisionClient(adjudicationPayload))
      .resolves.toEqual(adjudicationResponse)
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/client-actions',
      expect.objectContaining({
        body: JSON.stringify({
          action: 'adjudicateClientCollision',
          payload: adjudicationPayload,
        }),
      }),
    )
  })
})
