import { describe, expect, it } from 'vitest'
import {
  createDraftAccessionSelection,
  createExistingAccessionSelection,
  isPendingAccessionClient,
} from './accession'

const existingClient = {
  id: '11111111-1111-4111-8111-111111111111',
  id_card_num: '086094006827',
  name: 'Nguyen Van A',
  date_of_birth: '1994-09-21T00:00:00.000Z',
  gender: 'Nam' as const,
  phone: '0901234567',
  address: 'Can Tho',
  health_insurance_num: null,
  expiry_date: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('accession client selection', () => {
  it('maps an existing client to lookup-only resolution input', () => {
    expect(createExistingAccessionSelection(existingClient, 'manual')).toEqual({
      kind: 'existing',
      workflow: 'manual',
      client: existingClient,
      resolution: {
        kind: 'existing',
        governmentIdentityType: 'cccd',
        governmentIdentityValue: '086094006827',
        name: 'Nguyen Van A',
        dateOfBirth: '1994-09-21',
        phone: '0901234567',
      },
    })
  })

  it('maps a draft to creation input without trusting a client UUID', () => {
    const draft = {
      id_card_num: '331757192',
      name: 'Nguyen Van B',
      date_of_birth: '1990-01-02',
      gender: 'Nữ' as const,
      phone: '0912345678',
      address: 'Da Nang',
      health_insurance_num: '',
      expiry_date: '',
    }

    expect(createDraftAccessionSelection(draft, 'qr')).toEqual({
      kind: 'draft',
      workflow: 'qr',
      client: draft,
      resolution: {
        kind: 'draft',
        governmentIdentityType: 'cmnd',
        governmentIdentityValue: '331757192',
        name: 'Nguyen Van B',
        dateOfBirth: '1990-01-02',
        gender: 'Nữ',
        phone: '0912345678',
        address: 'Da Nang',
        healthInsuranceNum: null,
        expiryDate: null,
      },
    })
  })

  it('recognizes only the bounded pending preparation response', () => {
    expect(isPendingAccessionClient({
      kind: 'pending',
      workflow: 'manual',
      client: {
        id_card_num: '086094006827',
        name: 'Nguyen Van A',
        date_of_birth: '1994-09-21',
        gender: 'Nam',
        phone: '0901234567',
      },
    })).toBe(true)
    expect(isPendingAccessionClient(existingClient)).toBe(false)
  })
})
