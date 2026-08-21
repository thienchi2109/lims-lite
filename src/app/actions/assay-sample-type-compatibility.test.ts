import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

vi.mock('@/lib/auth-helpers', () => ({
  requireRole: (...args: unknown[]) => mocks.requireRole(...args),
  isAuthError: (value: unknown) =>
    typeof value === 'object' && value !== null && 'error' in value,
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

type ActionModule = {
  getAssaySampleTypeCatalogManager: (payload?: unknown) => Promise<unknown>
  cloneAssaySampleTypeCatalogRevision: (payload: unknown) => Promise<unknown>
  updateAssaySampleTypeCatalogReview: (payload: unknown) => Promise<unknown>
  reviewAssaySampleTypeCatalogRevision: (payload: unknown) => Promise<unknown>
  publishAssaySampleTypeCatalogRevision: (payload: unknown) => Promise<unknown>
  getPublishedAssaySampleTypeCatalog: (payload?: unknown) => Promise<unknown>
}

async function loadActions() {
  const filePath = join(
    process.cwd(),
    'src/app/actions/assay-sample-type-compatibility.ts',
  )
  expect(existsSync(filePath)).toBe(true)
  if (!existsSync(filePath)) return null

  const modulePath = './' + 'assay-sample-type-compatibility'
  return import(modulePath) as Promise<ActionModule>
}

describe('assay sample-type compatibility actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'manager',
    })
    mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null })
    mocks.order.mockResolvedValue({ data: [], error: null })
    mocks.is.mockReturnValue({ order: mocks.order })
    mocks.select.mockReturnValue({ is: mocks.is })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc, from: mocks.from })
  })

  it('forwards only manager-owned clone input to the RPC', async () => {
    const actions = await loadActions()
    if (!actions) return

    await actions.cloneAssaySampleTypeCatalogRevision({
      sourceRevisionNumber: 1,
      creationReason: 'Chuẩn bị revision hiệu chỉnh',
    })

    expect(mocks.requireRole).toHaveBeenCalledWith('manager')
    expect(mocks.rpc).toHaveBeenCalledWith(
      'clone_assay_sample_type_catalog_revision',
      {
        p_source_revision_number: 1,
        p_creation_reason: 'Chuẩn bị revision hiệu chỉnh',
      },
    )
  })

  it('parses the manager catalog response with lifecycle state', async () => {
    const actions = await loadActions()
    if (!actions) return

    const catalog = {
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
        isStale: true,
        reviewCompatibilityGeneration: 2,
        disposition: 'not_assignable',
        reviewReason: 'Chỉ tiêu đã ngưng hoạt động',
        compatibilities: [],
        candidates: [],
      }],
    }
    mocks.rpc.mockResolvedValueOnce({ data: catalog, error: null })

    const result = await actions.getAssaySampleTypeCatalogManager({})

    expect(result).toEqual({ data: catalog })
    expect(mocks.requireRole).toHaveBeenCalledWith('manager')
  })

  it('maps review input without forwarding server-owned fields', async () => {
    const actions = await loadActions()
    if (!actions) return

    const result = await actions.updateAssaySampleTypeCatalogReview({
      revisionId: '11111111-1111-4111-8111-111111111111',
      assayDefinitionId: '22222222-2222-4222-8222-222222222222',
      disposition: 'configured',
      reviewReason: 'Đã đối chiếu SOP',
      sampleTypeIds: ['33333333-3333-4333-8333-333333333333'],
      candidateDecisions: [],
      expectedRevisionUpdatedAt: '2026-08-20T08:00:00.000Z',
      contentHash: 'forbidden',
    })

    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reviews and publishes without accepting a client hash or actor', async () => {
    const actions = await loadActions()
    if (!actions) return

    await actions.reviewAssaySampleTypeCatalogRevision({
      revisionId: '11111111-1111-4111-8111-111111111111',
      expectedRevisionUpdatedAt: '2026-08-20T08:00:00.000Z',
    })
    await actions.publishAssaySampleTypeCatalogRevision({
      revisionId: '11111111-1111-4111-8111-111111111111',
      expectedRevisionUpdatedAt: '2026-08-20T08:01:00.000Z',
      publishReason: 'Phê duyệt theo SOP',
    })

    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      'review_assay_sample_type_catalog_revision',
      {
        p_revision_id: '11111111-1111-4111-8111-111111111111',
        p_expected_revision_updated_at: '2026-08-20T08:00:00.000Z',
      },
    )
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      'publish_assay_sample_type_catalog_revision',
      {
        p_revision_id: '11111111-1111-4111-8111-111111111111',
        p_expected_revision_updated_at: '2026-08-20T08:01:00.000Z',
        p_publish_reason: 'Phê duyệt theo SOP',
      },
    )
  })

  it('allows analysts and managers to read only the published catalog', async () => {
    const actions = await loadActions()
    if (!actions) return

    await actions.getPublishedAssaySampleTypeCatalog({
      sampleTypeId: '33333333-3333-4333-8333-333333333333',
    })

    expect(mocks.requireRole).toHaveBeenCalledWith(['analyst', 'manager'])
    expect(mocks.rpc).toHaveBeenCalledWith(
      'get_published_assay_sample_type_catalog',
      {
        p_sample_type_id: '33333333-3333-4333-8333-333333333333',
      },
    )
  })

  it('enriches the published catalog with active sample-type picker metadata', async () => {
    const actions = await loadActions()
    if (!actions) return

    mocks.rpc.mockResolvedValueOnce({
      data: {
        revisionNumber: 7,
        sampleTypeId: null,
        assays: [],
      },
      error: null,
    })
    mocks.order.mockResolvedValueOnce({
      data: [{
        id: '33333333-3333-4333-8333-333333333333',
        import_code: 'LM-000001',
        name: 'Máu',
      }],
      error: null,
    })

    const result = await actions.getPublishedAssaySampleTypeCatalog({})

    expect(mocks.from).toHaveBeenCalledWith('sample_types')
    expect(mocks.select).toHaveBeenCalledWith('id, import_code, name')
    expect(mocks.is).toHaveBeenCalledWith('deleted_at', null)
    expect(mocks.order).toHaveBeenCalledWith('name')
    expect(result).toEqual({
      data: {
        revisionNumber: 7,
        sampleTypeId: null,
        sampleTypes: [{
          id: '33333333-3333-4333-8333-333333333333',
          importCode: 'LM-000001',
          name: 'Máu',
        }],
        assays: [],
      },
    })
  })
})
