import 'server-only'
import { parseClientResolutionCategories } from './categories'
import type { AccessionClientWorkflow } from './accession'

export type ClientResolutionCutoverCategory = AccessionClientWorkflow

const VALID_CATEGORIES = new Set<ClientResolutionCutoverCategory>([
  'manual',
  'qr',
])

export function isClientResolutionV2Enabled(
  category: ClientResolutionCutoverCategory,
) {
  return parseClientResolutionCategories(
    process.env.CLIENT_RESOLUTION_V2_CATEGORIES,
    VALID_CATEGORIES,
  ).has(category)
}

export function isLegacyClientUpsertEnabled() {
  const configured =
    process.env.CLIENT_RESOLUTION_LEGACY_UPSERT?.trim().toLowerCase()

  return !configured || !['off', 'false', '0'].includes(configured)
}
