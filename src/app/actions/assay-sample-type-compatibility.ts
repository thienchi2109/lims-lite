'use server'

import { revalidatePath } from 'next/cache'
import { isAuthError, requireRole } from '@/lib/auth-helpers'
import { createClient } from '@/lib/supabase/server'
import {
  AssaySampleTypeCatalogManagerSchema,
  CloneAssaySampleTypeCatalogRevisionSchema,
  GetAssaySampleTypeCatalogManagerSchema,
  GetPublishedAssaySampleTypeCatalogSchema,
  PublishAssaySampleTypeCatalogRevisionSchema,
  PublishedAssaySampleTypeCatalogSchema,
  ReviewAssaySampleTypeCatalogRevisionSchema,
  UpdateAssaySampleTypeCatalogReviewSchema,
} from '@/types'

const MANAGER_ERROR = 'Chỉ Quản lý mới có thể quản trị catalog tương thích'
const CATALOG_ERROR = 'Dữ liệu catalog tương thích không hợp lệ'

function validationError() {
  return { error: CATALOG_ERROR }
}

async function requireCatalogManager() {
  const auth = await requireRole('manager')
  return isAuthError(auth) ? null : auth
}

async function runRpc(
  functionName: string,
  parameters: Record<string, unknown>,
) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(functionName, parameters)

    if (error) {
      console.error(`Compatibility catalog RPC ${functionName} failed:`, error)
      return { error: error.message }
    }

    return { data }
  } catch (error) {
    console.error(`Compatibility catalog RPC ${functionName} failed:`, error)
    return { error: 'Đã xảy ra lỗi không mong muốn' }
  }
}

export async function getAssaySampleTypeCatalogManager(payload?: unknown) {
  if (!await requireCatalogManager()) return { error: MANAGER_ERROR }

  const parsed = GetAssaySampleTypeCatalogManagerSchema.safeParse(payload ?? {})
  if (!parsed.success) return validationError()

  const result = await runRpc('get_assay_sample_type_catalog_manager', {
    p_revision_id: parsed.data.revisionId ?? null,
  })
  if ('error' in result) return result

  const catalog = AssaySampleTypeCatalogManagerSchema.safeParse(result.data)
  return catalog.success ? { data: catalog.data } : validationError()
}

export async function getPublishedAssaySampleTypeCatalog(payload?: unknown) {
  const auth = await requireRole(['analyst', 'manager'])
  if (isAuthError(auth)) {
    return { error: 'Bạn không có quyền đọc catalog tương thích đã publish' }
  }

  const parsed = GetPublishedAssaySampleTypeCatalogSchema.safeParse(payload ?? {})
  if (!parsed.success) return validationError()

  const result = await runRpc('get_published_assay_sample_type_catalog', {
    p_sample_type_id: parsed.data.sampleTypeId ?? null,
  })
  if ('error' in result) return result

  const catalog = PublishedAssaySampleTypeCatalogSchema.safeParse(result.data)
  return catalog.success ? { data: catalog.data } : validationError()
}

export async function cloneAssaySampleTypeCatalogRevision(payload: unknown) {
  if (!await requireCatalogManager()) return { error: MANAGER_ERROR }

  const parsed = CloneAssaySampleTypeCatalogRevisionSchema.safeParse(payload)
  if (!parsed.success) return validationError()

  const result = await runRpc('clone_assay_sample_type_catalog_revision', {
    p_source_revision_number: parsed.data.sourceRevisionNumber,
    p_creation_reason: parsed.data.creationReason,
  })
  if (!('error' in result)) {
    revalidatePath('/manager/assays/compatibility')
  }
  return result
}

export async function updateAssaySampleTypeCatalogReview(payload: unknown) {
  if (!await requireCatalogManager()) return { error: MANAGER_ERROR }

  const parsed = UpdateAssaySampleTypeCatalogReviewSchema.safeParse(payload)
  if (!parsed.success) return validationError()

  const result = await runRpc('update_assay_sample_type_catalog_review', {
    p_revision_id: parsed.data.revisionId,
    p_assay_definition_id: parsed.data.assayDefinitionId,
    p_disposition: parsed.data.disposition,
    p_review_reason: parsed.data.reviewReason,
    p_sample_type_ids: parsed.data.sampleTypeIds,
    p_candidate_decisions: parsed.data.candidateDecisions.map((decision) => ({
      candidate_id: decision.candidateId,
      decision: decision.decision,
      reason: decision.reason,
    })),
    p_expected_revision_updated_at: parsed.data.expectedRevisionUpdatedAt,
  })
  if (!('error' in result)) {
    revalidatePath('/manager/assays/compatibility')
  }
  return result
}

export async function reviewAssaySampleTypeCatalogRevision(payload: unknown) {
  if (!await requireCatalogManager()) return { error: MANAGER_ERROR }

  const parsed = ReviewAssaySampleTypeCatalogRevisionSchema.safeParse(payload)
  if (!parsed.success) return validationError()

  const result = await runRpc('review_assay_sample_type_catalog_revision', {
    p_revision_id: parsed.data.revisionId,
    p_expected_revision_updated_at: parsed.data.expectedRevisionUpdatedAt,
  })
  if (!('error' in result)) {
    revalidatePath('/manager/assays/compatibility')
  }
  return result
}

export async function publishAssaySampleTypeCatalogRevision(payload: unknown) {
  if (!await requireCatalogManager()) return { error: MANAGER_ERROR }

  const parsed = PublishAssaySampleTypeCatalogRevisionSchema.safeParse(payload)
  if (!parsed.success) return validationError()

  const result = await runRpc('publish_assay_sample_type_catalog_revision', {
    p_revision_id: parsed.data.revisionId,
    p_expected_revision_updated_at: parsed.data.expectedRevisionUpdatedAt,
    p_publish_reason: parsed.data.publishReason,
  })
  if (!('error' in result)) {
    revalidatePath('/manager/assays/compatibility')
  }
  return result
}
