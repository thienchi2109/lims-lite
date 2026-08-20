import type { AssaySampleTypeCatalogManager } from '@/types'

export type CompatibilityAssay =
  AssaySampleTypeCatalogManager['assays'][number]
export type CompatibilityCandidate = CompatibilityAssay['candidates'][number]
export type CoverageFilter =
  | 'all'
  | 'unreviewed'
  | 'candidate'
  | 'stale'
  | 'configured'
  | 'not_assignable'
  | 'inactive'
type CoverageStatus = Exclude<CoverageFilter, 'all'>

export type CandidateDecisionDraft = {
  decision: 'accepted' | 'rejected' | null
  reason: string
}

export type CompatibilityReviewPayload = {
  assayDefinitionId: string
  disposition: 'configured' | 'not_assignable'
  reviewReason: string
  sampleTypeIds: string[]
  candidateDecisions: Array<{
    candidateId: string
    decision: 'accepted' | 'rejected'
    reason: string
  }>
}

export type CatalogDiffDetail = {
  id: string
  assayName: string
  before: string
  after: string
}

function getCoverageStatus(assay: CompatibilityAssay): CoverageStatus {
  if (!assay.isActive) return 'inactive'
  if (assay.isStale) return 'stale'
  if (assay.candidates.some((candidate) => candidate.decision === null)) {
    return 'candidate'
  }
  if (assay.disposition === 'configured') return 'configured'
  if (assay.disposition === 'not_assignable') return 'not_assignable'
  return 'unreviewed'
}

export function getCoverageLabel(assay: CompatibilityAssay) {
  const labels: Record<CoverageStatus, string> = {
    inactive: 'Ngừng dùng',
    stale: 'Cần rà soát lại',
    candidate: 'Còn ứng viên',
    configured: 'Đã cấu hình',
    not_assignable: 'Không thể chỉ định',
    unreviewed: 'Chưa đánh giá',
  }
  return labels[getCoverageStatus(assay)]
}

export function matchesCoverageFilter(
  assay: CompatibilityAssay,
  filter: CoverageFilter,
) {
  return filter === 'all' || getCoverageStatus(assay) === filter
}

export function createCandidateDecisionDrafts(
  candidates: CompatibilityCandidate[],
) {
  return Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      {
        decision: candidate.decision,
        reason: candidate.decisionReason ?? '',
      },
    ]),
  ) as Record<string, CandidateDecisionDraft>
}

function getReviewLabel(
  disposition: CompatibilityAssay['disposition'],
  reason: string | null,
  generation: number | null,
) {
  const dispositionLabel = disposition === 'configured'
    ? 'Có thể chỉ định'
    : disposition === 'not_assignable'
      ? 'Không thể chỉ định'
      : 'Chưa đánh giá'
  const reasonLabel = reason ? `${dispositionLabel} - ${reason}` : dispositionLabel
  return generation
    ? `${reasonLabel} - Thế hệ tương thích ${generation}`
    : reasonLabel
}

function getCandidateDecisionLabel(
  candidate: CompatibilityCandidate | undefined,
  sampleTypeName: string,
) {
  if (!candidate) return `Không có ứng viên ${sampleTypeName}`
  const decisionLabel = candidate.decision === 'accepted'
    ? 'Chấp nhận'
    : candidate.decision === 'rejected'
      ? 'Từ chối'
      : 'Chưa quyết định'
  return candidate.decisionReason
    ? `Ứng viên ${sampleTypeName}: ${decisionLabel} - ${candidate.decisionReason}`
    : `Ứng viên ${sampleTypeName}: ${decisionLabel}`
}

export function createCatalogDiffDetails(
  catalog: AssaySampleTypeCatalogManager,
  sourceCatalog: AssaySampleTypeCatalogManager | null,
): CatalogDiffDetail[] {
  const sourceAssays = new Map(
    sourceCatalog?.assays.map((assay) => [assay.assayDefinitionId, assay])
      ?? [],
  )
  const sampleTypeNames = new Map(
    [...(sourceCatalog?.sampleTypes ?? []), ...catalog.sampleTypes].map(
      (sampleType) => [sampleType.id, sampleType.name],
    ),
  )
  const details: CatalogDiffDetail[] = []

  for (const assay of catalog.assays) {
    const sourceAssay = sourceAssays.get(assay.assayDefinitionId)
    const sourceSampleTypeIds = new Set(
      sourceAssay?.compatibilities.map((item) => item.sampleTypeId) ?? [],
    )
    const currentSampleTypeIds = new Set(
      assay.compatibilities.map((item) => item.sampleTypeId),
    )
    const sourceCandidates = new Map(
      sourceAssay?.candidates.map((candidate) => [
        candidate.sampleTypeId,
        candidate,
      ]) ?? [],
    )
    const currentCandidates = new Map(
      assay.candidates.map((candidate) => [candidate.sampleTypeId, candidate]),
    )

    for (const sampleTypeId of currentSampleTypeIds) {
      if (!sourceSampleTypeIds.has(sampleTypeId)) {
        details.push({
          id: `pair-added-${assay.assayDefinitionId}-${sampleTypeId}`,
          assayName: assay.name,
          before: 'Chưa tương thích',
          after: `Thêm ${sampleTypeNames.get(sampleTypeId) ?? 'loại mẫu'}`,
        })
      }
    }
    for (const sampleTypeId of sourceSampleTypeIds) {
      if (!currentSampleTypeIds.has(sampleTypeId)) {
        details.push({
          id: `pair-removed-${assay.assayDefinitionId}-${sampleTypeId}`,
          assayName: assay.name,
          before: sampleTypeNames.get(sampleTypeId) ?? 'Loại mẫu',
          after: `Bỏ ${sampleTypeNames.get(sampleTypeId) ?? 'loại mẫu'}`,
        })
      }
    }

    if (
      assay.disposition !== (sourceAssay?.disposition ?? null)
      || assay.reviewReason !== (sourceAssay?.reviewReason ?? null)
      || assay.reviewCompatibilityGeneration
        !== (sourceAssay?.reviewCompatibilityGeneration ?? null)
    ) {
      details.push({
        id: `review-${assay.assayDefinitionId}`,
        assayName: assay.name,
        before: getReviewLabel(
          sourceAssay?.disposition ?? null,
          sourceAssay?.reviewReason ?? null,
          sourceAssay?.reviewCompatibilityGeneration ?? null,
        ),
        after: getReviewLabel(
          assay.disposition,
          assay.reviewReason,
          assay.reviewCompatibilityGeneration,
        ),
      })
    }

    for (const sampleTypeId of new Set([
      ...sourceCandidates.keys(),
      ...currentCandidates.keys(),
    ])) {
      const sourceCandidate = sourceCandidates.get(sampleTypeId)
      const currentCandidate = currentCandidates.get(sampleTypeId)
      if (
        sourceCandidate?.decision !== currentCandidate?.decision
        || sourceCandidate?.decisionReason !== currentCandidate?.decisionReason
        || !sourceCandidate
        || !currentCandidate
      ) {
        const sampleTypeName = sampleTypeNames.get(sampleTypeId) ?? 'loại mẫu'
        details.push({
          id: `candidate-${assay.assayDefinitionId}-${sampleTypeId}`,
          assayName: assay.name,
          before: getCandidateDecisionLabel(
            sourceCandidate,
            sampleTypeName,
          ),
          after: getCandidateDecisionLabel(
            currentCandidate,
            sampleTypeName,
          ),
        })
      }
    }
  }

  return details
}

export function formatVietnameseDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function translateCompatibilityError(error: unknown) {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''

  const knownErrors: Record<string, string> = {
    CATALOG_REVISION_CONFLICT:
      'Bản nháp đã thay đổi. Vui lòng tải lại trước khi tiếp tục.',
    CATALOG_REVISION_STALE:
      'Bản nháp đã thay đổi. Vui lòng tải lại trước khi tiếp tục.',
    CATALOG_CANDIDATE_COVERAGE_INVALID:
      'Phải quyết định toàn bộ ứng viên của chỉ tiêu.',
    CATALOG_CANDIDATE_SELECTION_MISMATCH:
      'Quyết định ứng viên chưa khớp với loại mẫu đã chọn.',
    CATALOG_COVERAGE_INCOMPLETE:
      'Chưa đánh giá đầy đủ toàn bộ chỉ tiêu đang hoạt động.',
    CATALOG_REVIEW_REQUIRED:
      'Bản nháp phải được xác nhận trước khi xuất bản.',
    CATALOG_REVISION_NOT_REVIEWED:
      'Bản nháp phải được xác nhận trước khi xuất bản.',
    CATALOG_REVIEW_HASH_STALE:
      'Nội dung đã thay đổi sau khi xác nhận. Vui lòng xác nhận lại.',
    CATALOG_LIFECYCLE_STALE:
      'Danh mục chỉ tiêu hoặc loại mẫu đã thay đổi. Vui lòng rà soát lại.',
    CATALOG_CREATION_REASON_REQUIRED:
      'Vui lòng nhập lý do tạo bản nháp.',
    CATALOG_DRAFT_ALREADY_EXISTS:
      'Đã có một bản nháp đang mở. Vui lòng tải lại dữ liệu.',
    CATALOG_SOURCE_REVISION_NOT_PUBLISHED:
      'Phiên bản nguồn không còn ở trạng thái đã xuất bản.',
    CATALOG_REVIEW_COVERAGE_INCOMPLETE:
      'Chưa đánh giá đầy đủ toàn bộ chỉ tiêu đang hoạt động.',
    CATALOG_CANDIDATE_DECISIONS_INCOMPLETE:
      'Phải quyết định toàn bộ ứng viên của chỉ tiêu.',
    CATALOG_CONFIGURED_ASSAY_HAS_NO_SAMPLE_TYPE:
      'Chỉ tiêu có thể chỉ định phải có ít nhất một loại mẫu.',
    CATALOG_NOT_ASSIGNABLE_ASSAY_HAS_SAMPLE_TYPE:
      'Chỉ tiêu không thể chỉ định không được có loại mẫu tương thích.',
    CATALOG_CONTAINS_STALE_COMPATIBILITY:
      'Danh mục chỉ tiêu hoặc loại mẫu đã thay đổi. Vui lòng rà soát lại.',
    CATALOG_CANDIDATE_DECISION_MISMATCH:
      'Quyết định ứng viên chưa khớp với loại mẫu đã chọn.',
    CATALOG_SAMPLE_TYPE_NOT_ACTIVE:
      'Không thể thêm loại mẫu đã ngừng dùng.',
    CATALOG_PUBLISH_REASON_REQUIRED:
      'Vui lòng nhập lý do xuất bản.',
  }

  const matched = Object.entries(knownErrors).find(([code]) =>
    message.includes(code),
  )
  return matched?.[1] ?? 'Không thể cập nhật dữ liệu tương thích loại mẫu.'
}
