import 'server-only'

import { randomUUID } from 'node:crypto'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { ClientResolutionInput } from '@/types'
import { parseClientResolutionCategories } from './categories'

export type ClientResolutionShadowCategory = 'manual' | 'qr' | 'upsert'

type ClientResolutionShadowRequest = {
  category: ClientResolutionShadowCategory
  input: ClientResolutionInput
}

const DEFAULT_TIMEOUT_MS = 500
const MIN_TIMEOUT_MS = 25
const MAX_TIMEOUT_MS = 2_000
const VALID_CATEGORIES = new Set<ClientResolutionShadowCategory>([
  'manual',
  'qr',
  'upsert',
])

function getEnabledCategories() {
  return parseClientResolutionCategories(
    process.env.CLIENT_RESOLUTION_SHADOW_CATEGORIES,
    VALID_CATEGORIES,
  )
}

function getTimeoutMs() {
  const configured = Number.parseInt(
    process.env.CLIENT_RESOLUTION_SHADOW_TIMEOUT_MS ?? '',
    10,
  )

  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, configured))
}

function reportFailure(
  category: ClientResolutionShadowCategory,
  reason: 'auth_error' | 'rpc_error' | 'timeout',
) {
  console.warn('Client resolution shadow comparison failed', {
    category,
    reason,
  })
}

export async function runClientResolutionShadow({
  category,
  input,
}: ClientResolutionShadowRequest): Promise<void> {
  if (!getEnabledCategories().has(category)) return

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      reportFailure(category, 'auth_error')
      return
    }

    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, getTimeoutMs())
    timeout.unref?.()

    try {
      const admin = createAdminClient()
      const { error } = await admin
        .rpc('record_client_resolution_shadow_v1', {
          p_actor_id: user.id,
          p_caller_category: category,
          p_correlation_id: randomUUID(),
          p_government_identity_type:
            input.governmentIdentityType ?? null,
          p_government_identity_value:
            input.governmentIdentityValue ?? null,
          p_name: input.name,
          p_date_of_birth: input.dateOfBirth,
          p_phone: input.phone ?? null,
        })
        .abortSignal(controller.signal)

      if (error) {
        reportFailure(category, timedOut ? 'timeout' : 'rpc_error')
      }
    } catch {
      reportFailure(category, timedOut ? 'timeout' : 'rpc_error')
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    reportFailure(category, 'auth_error')
  }
}
