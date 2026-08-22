import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({
  requireRole: (...args: unknown[]) => mocks.requireRole(...args),
  isAuthError: (value: unknown) =>
    typeof value === 'object' && value !== null && 'error' in value,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

async function loadActions() {
  const filePath = join(process.cwd(), 'src/app/actions/client-lifecycle.ts')
  expect(existsSync(filePath)).toBe(true)
  if (!existsSync(filePath)) return null
  return import('./client-lifecycle')
}

const managerData = {
  clients: [],
  total: 0,
  activeCount: 0,
  inactiveCount: 0,
  collisionCount: 0,
}

describe('client lifecycle actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'manager',
    })
  })

  it('requires manager role before reading lifecycle data', async () => {
    mocks.requireRole.mockResolvedValue({ error: 'Only manager' })
    const actions = await loadActions()
    if (!actions) return

    const result = await actions.getClientLifecycleManager()

    expect(mocks.requireRole).toHaveBeenCalledWith('manager')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(result).toEqual({
      error: 'Chỉ Quản lý mới có thể quản lý vòng đời khách hàng',
    })
  })

  it('parses manager data and calls the additive list RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: managerData, error: null })
    const actions = await loadActions()
    if (!actions) return

    const result = await actions.getClientLifecycleManager({
      status: 'inactive',
      search: 'Nguyễn',
      limit: 25,
      offset: 0,
    })

    expect(mocks.rpc).toHaveBeenCalledWith(
      'get_client_lifecycle_manager_v1',
      {
        p_status: 'inactive',
        p_search: 'Nguyễn',
        p_limit: 25,
        p_offset: 0,
      },
    )
    expect(result).toEqual({ data: managerData })
  })

  it('sends expected row version and reason when deactivating', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'inactive',
        updatedAt: '2026-08-22T04:01:00.000Z',
      },
      error: null,
    })
    const actions = await loadActions()
    if (!actions) return

    await actions.deactivateClient({
      clientId: '11111111-1111-4111-8111-111111111111',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      reason: 'Ngừng sử dụng theo yêu cầu đã phê duyệt',
    })

    expect(mocks.rpc).toHaveBeenCalledWith('deactivate_client_v1', {
      p_client_id: '11111111-1111-4111-8111-111111111111',
      p_expected_updated_at: '2026-08-22T04:00:00.000Z',
      p_reason: 'Ngừng sử dụng theo yêu cầu đã phê duyệt',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/manager/clients')
  })

  it('maps database conflicts to sanitized Vietnamese without raw details', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P1114',
        message: 'sensitive raw identity 079203009012',
      },
    })
    const actions = await loadActions()
    if (!actions) return

    const result = await actions.restoreClient({
      clientId: '11111111-1111-4111-8111-111111111111',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      reason: 'Khôi phục theo hồ sơ đã xác minh',
    })

    expect(result).toEqual({
      error: 'Không thể hoàn tất vì thông tin đang xung đột với khách hàng hoạt động',
    })
    expect(JSON.stringify(result)).not.toContain('079203009012')
  })

  it('adjudicates a collision with both optimistic row versions', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        relatedClientId: '22222222-2222-4222-8222-222222222222',
        collisionType: 'phone',
        disposition: 'confirmed_distinct',
        adjudicatedAt: '2026-08-22T04:10:00.000Z',
      },
      error: null,
    })
    const actions = await loadActions()
    if (!actions) return

    const result = await actions.adjudicateClientCollision({
      clientId: '11111111-1111-4111-8111-111111111111',
      relatedClientId: '22222222-2222-4222-8222-222222222222',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      relatedExpectedUpdatedAt: '2026-08-22T04:05:00.000Z',
      collisionType: 'phone',
      disposition: 'confirmed_distinct',
      reason: 'Hai hồ sơ thuộc hai khách hàng khác nhau',
    })

    expect(mocks.rpc).toHaveBeenCalledWith('adjudicate_client_collision_v1', {
      p_client_id: '11111111-1111-4111-8111-111111111111',
      p_related_client_id: '22222222-2222-4222-8222-222222222222',
      p_expected_updated_at: '2026-08-22T04:00:00.000Z',
      p_related_expected_updated_at: '2026-08-22T04:05:00.000Z',
      p_collision_type: 'phone',
      p_disposition: 'confirmed_distinct',
      p_reason: 'Hai hồ sơ thuộc hai khách hàng khác nhau',
    })
    expect(result).toEqual({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        relatedClientId: '22222222-2222-4222-8222-222222222222',
        collisionType: 'phone',
        disposition: 'confirmed_distinct',
        adjudicatedAt: '2026-08-22T04:10:00.000Z',
      },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/manager/clients')
  })

  it('maps stale collision evidence to a sanitized Vietnamese error', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P1117',
        message: 'sensitive collision evidence',
      },
    })
    const actions = await loadActions()
    if (!actions) return

    const result = await actions.adjudicateClientCollision({
      clientId: '11111111-1111-4111-8111-111111111111',
      relatedClientId: '22222222-2222-4222-8222-222222222222',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      relatedExpectedUpdatedAt: '2026-08-22T04:05:00.000Z',
      collisionType: 'government_identity',
      disposition: 'correction_required',
      reason: 'Bằng chứng cần được kiểm tra lại',
    })

    expect(result).toEqual({
      error: 'Không thể xác nhận vì bằng chứng xung đột không còn hợp lệ',
    })
    expect(JSON.stringify(result)).not.toContain('sensitive collision evidence')
  })

  it('passes explicit corrected identity fields to the adjudication RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'active',
        updatedAt: '2026-08-22T04:02:00.000Z',
      },
      error: null,
    })
    const actions = await loadActions()
    if (!actions) return

    await actions.correctClientIdentity({
      clientId: '11111111-1111-4111-8111-111111111111',
      expectedUpdatedAt: '2026-08-22T04:00:00.000Z',
      idCardNum: '079203009012',
      name: 'Nguyễn Văn A',
      dateOfBirth: '1990-01-01',
      gender: 'Nam',
      phone: '0901234567',
      reason: 'Hiệu chỉnh theo giấy tờ gốc',
    })

    expect(mocks.rpc).toHaveBeenCalledWith('correct_client_identity_v1', {
      p_client_id: '11111111-1111-4111-8111-111111111111',
      p_expected_updated_at: '2026-08-22T04:00:00.000Z',
      p_id_card_num: '079203009012',
      p_name: 'Nguyễn Văn A',
      p_date_of_birth: '1990-01-01',
      p_gender: 'Nam',
      p_phone: '0901234567',
      p_reason: 'Hiệu chỉnh theo giấy tờ gốc',
    })
  })
})
