import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireRole: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/auth-helpers', () => ({
  requireRole: (...args: unknown[]) => mocks.requireRole(...args),
  isAuthError: (result: unknown) =>
    typeof result === 'object' &&
    result !== null &&
    'error' in result,
}))

import {
  resolveClientIdentityV2,
  resolveOrCreateClientV2,
} from './server'

describe('client resolver v2 server boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      role: 'analyst',
    })
    mocks.createClient.mockResolvedValue({
      rpc: mocks.rpc,
    })
  })

  it('maps the resolver RPC row into the strict application contract', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          outcome: 'matched',
          reason_code: 'trusted_identity_match',
          client_id: '11111111-1111-4111-8111-111111111111',
          created: false,
        },
      ],
      error: null,
    })

    const result = await resolveClientIdentityV2({
      governmentIdentityType: 'cccd',
      governmentIdentityValue: '086094006827',
      name: 'Nguyễn Văn A',
      dateOfBirth: '1994-09-21',
      phone: '0901234567',
    })

    expect(mocks.rpc).toHaveBeenCalledWith('resolve_client_identity_v2', {
      p_government_identity_type: 'cccd',
      p_government_identity_value: '086094006827',
      p_name: 'Nguyễn Văn A',
      p_date_of_birth: '1994-09-21',
      p_phone: '0901234567',
    })
    expect(result).toEqual({
      data: {
        outcome: 'matched',
        reasonCode: 'trusted_identity_match',
        clientId: '11111111-1111-4111-8111-111111111111',
        created: false,
      },
    })
  })

  it('maps resolve-and-create profile fields without normalizing identity keys', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          outcome: 'matched',
          reason_code: 'client_created',
          client_id: '22222222-2222-4222-8222-222222222222',
          created: true,
        },
      ],
      error: null,
    })

    await resolveOrCreateClientV2({
      governmentIdentityType: null,
      governmentIdentityValue: null,
      name: '  Trần Văn B ',
      dateOfBirth: '1980-01-02',
      gender: 'Nữ',
      phone: ' +84907654321 ',
      address: 'Cần Thơ',
    })

    expect(mocks.rpc).toHaveBeenCalledWith('resolve_or_create_client_v2', {
      p_government_identity_type: null,
      p_government_identity_value: null,
      p_name: '  Trần Văn B ',
      p_date_of_birth: '1980-01-02',
      p_gender: 'Nữ',
      p_phone: ' +84907654321 ',
      p_address: 'Cần Thơ',
      p_health_insurance_num: null,
      p_expiry_date: null,
    })
  })

  it('never returns raw PostgreSQL errors', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "clients_unique_trusted_government_identity"',
        details: 'Key (government_identity_value)=(086094006827) already exists',
      },
    })

    const result = await resolveClientIdentityV2({
      governmentIdentityType: 'cccd',
      governmentIdentityValue: '086094006827',
      name: 'Nguyễn Văn A',
      dateOfBirth: '1994-09-21',
    })

    expect(result).toEqual({
      error: 'Không thể phân giải khách hàng. Vui lòng thử lại.',
    })
    expect(JSON.stringify(result)).not.toMatch(
      /duplicate key|clients_unique|086094006827/i,
    )
  })

  it.each([
    ['resolve', resolveClientIdentityV2],
    ['resolve-and-create', resolveOrCreateClientV2],
  ] as const)(
    'denies %s before creating a database client when the role is unauthorized',
    async (_, resolver) => {
      mocks.requireRole.mockResolvedValue({ error: 'Unauthorized' })

      const result = await resolver({
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
        ...(resolver === resolveOrCreateClientV2
          ? { gender: 'Nam' as const, phone: '0901234567' }
          : {}),
      })

      expect(mocks.requireRole).toHaveBeenCalledWith(['analyst', 'manager'])
      expect(mocks.createClient).not.toHaveBeenCalled()
      expect(mocks.rpc).not.toHaveBeenCalled()
      expect(result).toEqual({
        error: 'Bạn không có quyền phân giải khách hàng',
      })
    },
  )

  it.each([
    ['resolve', resolveClientIdentityV2],
    ['resolve-and-create', resolveOrCreateClientV2],
  ] as const)(
    'sanitizes rejected %s RPC promises',
    async (_, resolver) => {
      mocks.rpc.mockRejectedValue(
        new Error('client 086094006827 violates clients_unique_identity'),
      )

      const result = await resolver({
        name: 'Nguyễn Văn A',
        dateOfBirth: '1994-09-21',
        ...(resolver === resolveOrCreateClientV2
          ? { gender: 'Nam' as const, phone: '0901234567' }
          : {}),
      })

      expect(result).toEqual({
        error: 'Không thể phân giải khách hàng. Vui lòng thử lại.',
      })
      expect(JSON.stringify(result)).not.toMatch(
        /086094006827|clients_unique_identity/i,
      )
    },
  )

  it('maps restricted database reasons to a non-disclosing public conflict', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          outcome: 'conflict',
          reason_code: 'restricted_candidate',
          client_id: null,
          created: false,
        },
      ],
      error: null,
    })

    const result = await resolveClientIdentityV2({
      name: 'Nguyễn Văn A',
      dateOfBirth: '1994-09-21',
    })

    expect(result).toEqual({
      data: {
        outcome: 'conflict',
        reasonCode: 'identity_conflict',
        clientId: null,
        created: false,
      },
    })
    expect(JSON.stringify(result)).not.toMatch(/restricted|confidential/i)
  })

  it('rejects malformed RPC output without returning database payloads', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          outcome: 'conflict',
          reason_code: 'restricted_candidate',
          client_id: '33333333-3333-4333-8333-333333333333',
          created: false,
        },
      ],
      error: null,
    })

    const result = await resolveClientIdentityV2({
      name: 'Nguyễn Văn A',
      dateOfBirth: '1994-09-21',
    })

    expect(result).toEqual({
      error: 'Không thể phân giải khách hàng. Vui lòng thử lại.',
    })
  })
})
