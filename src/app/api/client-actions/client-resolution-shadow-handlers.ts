import {
  findClientByIdentity,
  upsertClient,
} from '@/app/actions/clients'
import {
  runClientResolutionShadow,
  type ClientResolutionShadowCategory,
} from '@/lib/client-resolution/shadow'
import { CreateClientSchema, type CreateClient } from '@/types'

type IdentityLookupRequest = {
  category: Exclude<ClientResolutionShadowCategory, 'upsert'>
  governmentIdentityValue?: string | null
  name: string
  dateOfBirth: string
}

function classifyGovernmentIdentity(value?: string | null) {
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

async function containShadowFailure(task: () => Promise<void>) {
  try {
    await task()
  } catch {
    // Shadow evaluation must never influence the legacy response or mutation.
  }
}

export async function findClientByIdentityWithShadow({
  category,
  governmentIdentityValue,
  name,
  dateOfBirth,
}: IdentityLookupRequest) {
  await containShadowFailure(() =>
    runClientResolutionShadow({
      category,
      input: {
        ...classifyGovernmentIdentity(governmentIdentityValue),
        name,
        dateOfBirth,
        phone: null,
      },
    }),
  )

  return findClientByIdentity(name, dateOfBirth)
}

export async function upsertClientWithShadow(data: CreateClient) {
  const parsed = CreateClientSchema.safeParse(data)

  if (parsed.success) {
    await containShadowFailure(() =>
      runClientResolutionShadow({
        category: 'upsert',
        input: {
          ...classifyGovernmentIdentity(parsed.data.id_card_num),
          name: parsed.data.name,
          dateOfBirth: parsed.data.date_of_birth,
          phone: parsed.data.phone,
        },
      }),
    )
  }

  return upsertClient(data)
}
