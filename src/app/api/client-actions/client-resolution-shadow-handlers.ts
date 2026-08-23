import {
  findClientByIdentity,
  getClient,
  upsertClient,
} from '@/app/actions/clients'
import {
  isClientResolutionV2Enabled,
  isLegacyClientUpsertEnabled,
  type ClientResolutionCutoverCategory,
} from '@/lib/client-resolution/cutover'
import { localizeClientResolution } from '@/lib/client-resolution/messages'
import { resolveClientIdentityV2 } from '@/lib/client-resolution/server'
import {
  runClientResolutionShadow,
  type ClientResolutionShadowCategory,
} from '@/lib/client-resolution/shadow'
import { classifyGovernmentIdentity } from '@/lib/client-resolution/accession'
import {
  CreateClientSchema,
  type ClientResolutionInput,
  type CreateClient,
} from '@/types'

type IdentityLookupRequest = {
  category: Exclude<ClientResolutionShadowCategory, 'upsert'>
  governmentIdentityValue?: string | null
  name: string
  dateOfBirth: string
}

function createResolutionInput({
  governmentIdentityValue,
  name,
  dateOfBirth,
}: Omit<IdentityLookupRequest, 'category'>): ClientResolutionInput {
  return {
    ...classifyGovernmentIdentity(governmentIdentityValue),
    name,
    dateOfBirth,
    phone: null,
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
  const input = createResolutionInput({
    governmentIdentityValue,
    name,
    dateOfBirth,
  })

  await containShadowFailure(() =>
    runClientResolutionShadow({
      category,
      input,
    }),
  )

  if (isClientResolutionV2Enabled(category)) {
    const resolution = await resolveClientIdentityV2(input)
    if ('error' in resolution) {
      return resolution
    }

    if (resolution.data.outcome === 'matched') {
      if (!resolution.data.clientId) {
        return {
          error: 'Không thể phân giải khách hàng. Vui lòng thử lại.',
        }
      }
      return getClient(resolution.data.clientId)
    }

    if (resolution.data.outcome === 'not_found') {
      return {
        data: null,
        resolution: resolution.data,
      }
    }

    const localized = localizeClientResolution(resolution.data)
    return {
      error: `${localized.label}: ${localized.message}`,
    }
  }

  return findClientByIdentity(name, dateOfBirth)
}

export async function upsertClientWithShadow(
  data: CreateClient,
  workflow?: ClientResolutionCutoverCategory,
) {
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

  if (workflow && isClientResolutionV2Enabled(workflow)) {
    if (!parsed.success) {
      return {
        error:
          parsed.error.issues[0]?.message ??
          'Thông tin khách hàng không hợp lệ',
      }
    }

    const input: ClientResolutionInput = {
      ...classifyGovernmentIdentity(parsed.data.id_card_num),
      name: parsed.data.name,
      dateOfBirth: parsed.data.date_of_birth,
      phone: parsed.data.phone,
    }
    const resolution = await resolveClientIdentityV2(input)
    if ('error' in resolution) {
      return resolution
    }

    if (resolution.data.outcome === 'matched') {
      if (!resolution.data.clientId) {
        return {
          error: 'Không thể phân giải khách hàng. Vui lòng thử lại.',
        }
      }
      return getClient(resolution.data.clientId)
    }

    if (resolution.data.outcome === 'not_found') {
      return {
        data: {
          kind: 'pending' as const,
          workflow,
          client: parsed.data,
        },
        resolution: resolution.data,
      }
    }

    const localized = localizeClientResolution(resolution.data)
    return {
      error: `${localized.label}: ${localized.message}`,
    }
  }

  if (!isLegacyClientUpsertEnabled()) {
    return {
      error:
        'Luồng lưu khách hàng cũ đã bị tắt. Vui lòng tải lại trang và thử lại.',
    }
  }

  return upsertClient(data)
}
