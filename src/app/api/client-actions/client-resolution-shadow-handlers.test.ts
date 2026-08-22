import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findClientByIdentity: vi.fn(),
  upsertClient: vi.fn(),
  runClientResolutionShadow: vi.fn(),
}))

vi.mock('@/app/actions/clients', () => ({
  findClientByIdentity: mocks.findClientByIdentity,
  upsertClient: mocks.upsertClient,
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
    mocks.runClientResolutionShadow.mockResolvedValue(undefined)
    mocks.findClientByIdentity.mockResolvedValue({ data: CLIENT })
    mocks.upsertClient.mockResolvedValue({ data: CLIENT })
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

  it('runs the upsert shadow comparison before the legacy mutation', async () => {
    const order: string[] = []
    mocks.runClientResolutionShadow.mockImplementation(async () => {
      order.push('shadow')
    })
    mocks.upsertClient.mockImplementation(async () => {
      order.push('legacy-upsert')
      return { data: CLIENT }
    })

    const result = await upsertClientWithShadow(UPSERT_INPUT)

    expect(order).toEqual(['shadow', 'legacy-upsert'])
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
    expect(mocks.upsertClient).toHaveBeenCalledWith(UPSERT_INPUT)
  })

  it('keeps legacy upsert behavior when shadow comparison rejects', async () => {
    mocks.runClientResolutionShadow.mockRejectedValue(
      new Error('shadow unavailable'),
    )

    await expect(upsertClientWithShadow(UPSERT_INPUT)).resolves.toEqual({
      data: CLIENT,
    })
    expect(mocks.upsertClient).toHaveBeenCalledWith(UPSERT_INPUT)
  })
})
