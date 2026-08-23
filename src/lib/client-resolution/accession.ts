import { z } from 'zod'
import {
  CreateClientSchema,
  type AccessionClientResolution,
  type Client,
  type CreateClient,
} from '@/types'

export const AccessionClientWorkflowSchema = z.enum(['manual', 'qr'])
export type AccessionClientWorkflow = z.infer<
  typeof AccessionClientWorkflowSchema
>

export const PendingAccessionClientSchema = z.strictObject({
  kind: z.literal('pending'),
  workflow: AccessionClientWorkflowSchema,
  client: CreateClientSchema,
})
export type PendingAccessionClient = z.infer<
  typeof PendingAccessionClientSchema
>

type ExistingResolution = Extract<
  AccessionClientResolution,
  { kind: 'existing' }
>
type DraftResolution = Extract<
  AccessionClientResolution,
  { kind: 'draft' }
>

export type AccessionClientSelection =
  | {
      kind: 'existing'
      workflow: AccessionClientWorkflow
      client: Client
      resolution: ExistingResolution
    }
  | {
      kind: 'draft'
      workflow: AccessionClientWorkflow
      client: CreateClient
      resolution: DraftResolution
    }

export function classifyGovernmentIdentity(value?: string | null) {
  const trimmed = value?.trim() ?? ''

  if (/^\d{12}$/.test(trimmed)) {
    return {
      governmentIdentityType: 'cccd' as const,
      governmentIdentityValue: trimmed,
    }
  }

  if (/^\d{9}$/.test(trimmed)) {
    return {
      governmentIdentityType: 'cmnd' as const,
      governmentIdentityValue: trimmed,
    }
  }

  return {
    governmentIdentityType: null,
    governmentIdentityValue: null,
  }
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function createExistingAccessionSelection(
  client: Client,
  workflow: AccessionClientWorkflow,
): AccessionClientSelection {
  return {
    kind: 'existing',
    workflow,
    client,
    resolution: {
      kind: 'existing',
      ...classifyGovernmentIdentity(client.id_card_num),
      name: client.name,
      dateOfBirth: client.date_of_birth.split('T')[0],
      phone: client.phone,
    },
  }
}

export function createDraftAccessionSelection(
  client: CreateClient,
  workflow: AccessionClientWorkflow,
): AccessionClientSelection {
  return {
    kind: 'draft',
    workflow,
    client,
    resolution: {
      kind: 'draft',
      ...classifyGovernmentIdentity(client.id_card_num),
      name: client.name,
      dateOfBirth: client.date_of_birth.split('T')[0],
      gender: client.gender,
      phone: client.phone,
      address: emptyToNull(client.address),
      healthInsuranceNum: emptyToNull(client.health_insurance_num),
      expiryDate: emptyToNull(client.expiry_date),
    },
  }
}

export function isPendingAccessionClient(
  value: unknown,
): value is PendingAccessionClient {
  return PendingAccessionClientSchema.safeParse(value).success
}
