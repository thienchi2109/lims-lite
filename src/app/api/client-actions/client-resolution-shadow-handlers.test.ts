import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  findClientByIdentity: vi.fn(),
  getClient: vi.fn(),
  upsertClient: vi.fn(),
  resolveOrCreateClientV2: vi.fn(),
  resolveClientIdentityV2: vi.fn(),
  runClientResolutionShadow: vi.fn(),
}))

vi.mock('@/app/actions/clients', () => ({
  findClientByIdentity: mocks.findClientByIdentity,
  getClient: mocks.getClient,
  upsertClient: mocks.upsertClient,
}))

vi.mock('@/lib/client-resolution/server', () => ({
  resolveClientIdentityV2: mocks.resolveClientIdentityV2,
  resolveOrCreateClientV2: mocks.resolveOrCreateClientV2,
}))

vi.mock('@/lib/client-resolution/shadow', () => ({
  runClientResolutionShadow: mocks.runClientResolutionShadow,
}))

import {
  findClientByIdentityWithShadow,
  upsertClientWithShadow,
} from './client-resolution-shadow-handlers'

const CLIENT = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Nguyen Van A',
}

const UPSERT_INPUT = {
  id_card_num: '086094006827',
  name: 'Nguyen Van A',
  date_of_birth: '1994-09-21',
  gender: 'Nam' as const,
  phone: '0901234567',
  address: '',
  health_insurance_num: '',
  expiry_date: '',
}

describe('client action shadow handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CLIENT_RESOLUTION_V2_CATEGORIES
    delete process.env.CLIENT_RESOLUTION_LEGACY_UPSERT
    mocks.runClientResolutionShadow.mockResolvedValue(undefined)
    mocks.findClientByIdentity.mockResolvedValue({ data: CLIENT })
    mocks.getClient.mockResolvedValue({ data: CLIENT })
    mocks.upsertClient.mockResolvedValue({ data: CLIENT })
    mocks.resolveOrCreateClientV2.mockResolvedValue({
      data: {
        outcome: 'matched',
        reasonCode: 'client_created',
        clientId: CLIENT.id,
        created: true,
      },
    })
    mocks.resolveClientIdentityV2.mockResolvedValue({
      data: {
        outcome: 'matched',
        reasonCode: 'trusted_identity_match',
        clientId: CLIENT.id,
        created: false,
      },
    })
  })

  it('runs a manual shadow comparison before returning the legacy lookup result', async () => {
    const order: string[] = []
    mocks.runClientResolutionShadow.mockImplementation(async () => {
      order.push('shadow')
    })
    mocks.findClientByIdentity.mockImplementation(async () => {
      order.push('legacy')
      return { data: CLIENT }
    })

    const result = await findClientByIdentityWithShadow({
      category: 'manual',
      name: 'Nguyen Van A',
      dateOfBirth: '1994-09-21',
    })

    expect(order).toEqual(['shadow', 'legacy'])
    expect(result).toEqual({ data: CLIENT })
    expect(mocks.runClientResolutionShadow).toHaveBeenCalledWith({
      category: 'manual',
      input: {
        governmentIdentityType: null,
        governmentIdentityValue: null,
        name: 'Nguyen Van A',
        dateOfBirth: '1994-09-21',
        phone: null,
      },
    })
  })

  it('classifies a QR identity server-side while preserving the legacy response', async () => {
    const result = await findClientByIdentityWithShadow({
      category: 'qr',
      governmentIdentityValue: '086094006827',
      name: 'Nguyen Van A',
      dateOfBirth: '1994-09-21',
    })

    expect(result).toEqual({ data: CLIENT })
    expect(mocks.runClientResolutionShadow).toHaveBeenCalledWith({
      category: 'qr',
      input: {
        governmentIdentityType: 'cccd',
        governmentIdentityValue: '086094006827',
        name: 'Nguyen Van A',
        dateOfBirth: '1994-09-21',
        phone: null,
      },
    })
    expect(mocks.findClientByIdentity).toHaveBeenCalledWith(
      'Nguyen Van A',
      '1994-09-21',
    )
  })

  it('runs the upsert shadow comparison before the resolver-backed mutation', async () => {
    const order: string[] = []
    mocks.runClientResolutionShadow.mockImplementation(async () => {
      order.push('shadow')
    })
    mocks.resolveOrCreateClientV2.mockImplementation(async () => {
      order.push('resolver')
      return {
        data: {
          outcome: 'matched',
          reasonCode: 'client_created',
          clientId: CLIENT.id,
          created: true,
        },
      }
    })

    const result = await upsertClientWithShadow(UPSERT_INPUT)

    expect(order).toEqual(['shadow', 'resolver'])
    expect(result).toEqual({ data: CLIENT })
    expect(mocks.runClientResolutionShadow).toHaveBeenCalledWith({
      category: 'upsert',
      input: {
        governmentIdentityType: 'cccd',
        governmentIdentityValue: '086094006827',
        name: 'Nguyen Van A',
        dateOfBirth: '1994-09-21',
        phone: '0901234567',
      },
    })
    expect(mocks.resolveOrCreateClientV2).toHaveBeenCalledWith({
      governmentIdentityType: 'cccd',
      governmentIdentityValue: '086094006827',
      name: 'Nguyen Van A',
      dateOfBirth: '1994-09-21',
      gender: 'Nam',
      phone: '0901234567',
      address: null,
      healthInsuranceNum: null,
      expiryDate: null,
    })
  })

  it('keeps the resolver-backed mutation when shadow comparison rejects', async () => {
    mocks.runClientResolutionShadow.mockRejectedValue(
      new Error('shadow unavailable'),
    )

    await expect(upsertClientWithShadow(UPSERT_INPUT)).resolves.toEqual({
      data: CLIENT,
    })
    expect(mocks.resolveOrCreateClientV2).toHaveBeenCalled()
    expect(mocks.upsertClient).not.toHaveBeenCalled()
  })

  it('routes an enabled QR lookup through v2 and returns the compatible client payload', async () => {
    process.env.CLIENT_RESOLUTION_V2_CATEGORIES = 'qr'

    const result = await findClientByIdentityWithShadow({
      category: 'qr',
      governmentIdentityValue: '086094006827',
      name: 'Nguyen Van A',
      dateOfBirth: '1994-09-21',
    })

    expect(result).toEqual({ data: CLIENT })
    expect(mocks.resolveClientIdentityV2).toHaveBeenCalledWith({
      governmentIdentityType: 'cccd',
      governmentIdentityValue: '086094006827',
      name: 'Nguyen Van A',
      dateOfBirth: '1994-09-21',
      phone: null,
    })
    expect(mocks.getClient).toHaveBeenCalledWith(CLIENT.id)
    expect(mocks.findClientByIdentity).not.toHaveBeenCalled()
  })

  it('returns a compatible not-found lookup without creating or mutating a client', async () => {
    process.env.CLIENT_RESOLUTION_V2_CATEGORIES = 'qr'
    mocks.resolveClientIdentityV2.mockResolvedValue({
      data: {
        outcome: 'not_found',
        reasonCode: 'trusted_identity_not_found',
        clientId: null,
        created: false,
      },
    })

    const result = await findClientByIdentityWithShadow({
      category: 'qr',
      governmentIdentityValue: '086094006827',
      name: 'Nguyen Van A',
      dateOfBirth: '1994-09-21',
    })

    expect(result).toEqual({
      data: null,
      resolution: {
        outcome: 'not_found',
        reasonCode: 'trusted_identity_not_found',
        clientId: null,
        created: false,
      },
    })
    expect(mocks.getClient).not.toHaveBeenCalled()
    expect(mocks.upsertClient).not.toHaveBeenCalled()
  })

  it.each([
    [
      'ambiguous',
      'trusted_identity_ambiguous',
      'Không thể xác định duy nhất',
    ],
    [
      'conflict',
      'inactive_candidate',
      'Xung đột thông tin',
    ],
    [
      'conflict',
      'identity_conflict',
      'Xung đột thông tin',
    ],
  ] as const)(
    'fails closed for %s without exposing or mutating a candidate',
    async (outcome, reasonCode, expectedLabel) => {
      process.env.CLIENT_RESOLUTION_V2_CATEGORIES = 'qr'
      mocks.resolveClientIdentityV2.mockResolvedValue({
        data: {
          outcome,
          reasonCode,
          clientId: null,
          created: false,
        },
      })

      const result = await findClientByIdentityWithShadow({
        category: 'qr',
        governmentIdentityValue: '086094006827',
        name: 'Nguyen Van A',
        dateOfBirth: '1994-09-21',
      })

      expect(result).toEqual({
        error: expect.stringContaining(expectedLabel),
      })
      expect(mocks.getClient).not.toHaveBeenCalled()
      expect(mocks.findClientByIdentity).not.toHaveBeenCalled()
      expect(mocks.upsertClient).not.toHaveBeenCalled()
    },
  )

  it('blocks the raw name and date-of-birth upsert when the retirement switch is off', async () => {
    process.env.CLIENT_RESOLUTION_LEGACY_UPSERT = 'off'

    const result = await upsertClientWithShadow(UPSERT_INPUT)

    expect(result).toEqual({
      error:
        'Luồng lưu khách hàng cũ đã bị tắt. Vui lòng tải lại trang và thử lại.',
    })
    expect(mocks.upsertClient).not.toHaveBeenCalled()
  })

  it('prepares a not-found manual accession client without writing it early', async () => {
    process.env.CLIENT_RESOLUTION_V2_CATEGORIES = 'manual'
    mocks.resolveClientIdentityV2.mockResolvedValue({
      data: {
        outcome: 'not_found',
        reasonCode: 'trusted_identity_not_found',
        clientId: null,
        created: false,
      },
    })

    const result = await upsertClientWithShadow(UPSERT_INPUT, 'manual')

    expect(result).toEqual({
      data: {
        kind: 'pending',
        workflow: 'manual',
        client: UPSERT_INPUT,
      },
      resolution: {
        outcome: 'not_found',
        reasonCode: 'trusted_identity_not_found',
        clientId: null,
        created: false,
      },
    })
    expect(mocks.resolveClientIdentityV2).toHaveBeenCalledWith({
      governmentIdentityType: 'cccd',
      governmentIdentityValue: '086094006827',
      name: 'Nguyen Van A',
      dateOfBirth: '1994-09-21',
      phone: '0901234567',
    })
    expect(mocks.upsertClient).not.toHaveBeenCalled()
  })

  it('returns an existing client when v2 preparation matches during a race', async () => {
    process.env.CLIENT_RESOLUTION_V2_CATEGORIES = 'qr'

    const result = await upsertClientWithShadow(UPSERT_INPUT, 'qr')

    expect(result).toEqual({ data: CLIENT })
    expect(mocks.getClient).toHaveBeenCalledWith(CLIENT.id)
    expect(mocks.upsertClient).not.toHaveBeenCalled()
  })

  it('fails closed when v2 preparation finds an unsafe match', async () => {
    process.env.CLIENT_RESOLUTION_V2_CATEGORIES = 'manual'
    mocks.resolveClientIdentityV2.mockResolvedValue({
      data: {
        outcome: 'conflict',
        reasonCode: 'phone_conflict',
        clientId: null,
        created: false,
      },
    })

    const result = await upsertClientWithShadow(UPSERT_INPUT, 'manual')

    expect(result).toEqual({
      error: expect.stringContaining('Xung đột thông tin'),
    })
    expect(mocks.getClient).not.toHaveBeenCalled()
    expect(mocks.upsertClient).not.toHaveBeenCalled()
  })
})
