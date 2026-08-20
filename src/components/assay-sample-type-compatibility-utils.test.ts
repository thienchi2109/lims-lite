import { describe, expect, it } from 'vitest'

import {
  createCatalogDiffDetails,
  translateCompatibilityError,
} from '@/components/assay-sample-type-compatibility-utils'
import type { AssaySampleTypeCatalogManager } from '@/types'

describe('translateCompatibilityError', () => {
  it.each([
    [
      'CATALOG_REVISION_CONFLICT',
      'Bản nháp đã thay đổi. Vui lòng tải lại trước khi tiếp tục.',
    ],
    [
      'CATALOG_REVIEW_REQUIRED',
      'Bản nháp phải được xác nhận trước khi xuất bản.',
    ],
    [
      'CATALOG_REVIEW_HASH_STALE',
      'Nội dung đã thay đổi sau khi xác nhận. Vui lòng xác nhận lại.',
    ],
    [
      'CATALOG_REVIEW_COVERAGE_INCOMPLETE',
      'Chưa đánh giá đầy đủ toàn bộ chỉ tiêu đang hoạt động.',
    ],
    [
      'CATALOG_CANDIDATE_DECISIONS_INCOMPLETE',
      'Phải quyết định toàn bộ ứng viên của chỉ tiêu.',
    ],
    [
      'CATALOG_CONTAINS_STALE_COMPATIBILITY',
      'Danh mục chỉ tiêu hoặc loại mẫu đã thay đổi. Vui lòng rà soát lại.',
    ],
  ])('maps %s to an actionable Vietnamese error', (code, expected) => {
    expect(translateCompatibilityError(code)).toBe(expected)
  })
})

function createCandidateCatalog(
  decision: 'accepted' | 'rejected' | null,
  decisionReason: string | null,
): AssaySampleTypeCatalogManager {
  return {
    revision: null,
    diff: {
      addedPairCount: 0,
      removedPairCount: 0,
      changedReviewCount: 0,
    },
    sampleTypes: [{
      id: '11111111-1111-4111-8111-111111111111',
      importCode: 'LM-000001',
      name: 'Huyết thanh',
      compatibilityGeneration: 1,
      isActive: true,
    }],
    assays: [{
      assayDefinitionId: '22222222-2222-4222-8222-222222222222',
      importCode: 'XN-GLU',
      name: 'Glucose',
      methodName: 'Hexokinase',
      specialtyId: null,
      compatibilityGeneration: 1,
      isActive: true,
      isStale: false,
      reviewCompatibilityGeneration: null,
      disposition: null,
      reviewReason: null,
      compatibilities: [],
      candidates: [{
        id: '33333333-3333-4333-8333-333333333333',
        sampleTypeId: '11111111-1111-4111-8111-111111111111',
        observationCount: 12,
        firstObservedAt: '2026-06-01T00:00:00.000Z',
        lastObservedAt: '2026-08-15T00:00:00.000Z',
        decision,
        decisionReason,
      }],
    }],
  }
}

describe('createCatalogDiffDetails', () => {
  it('includes candidate decision and reason changes', () => {
    const source = createCandidateCatalog(null, null)
    const current = createCandidateCatalog(
      'rejected',
      'Chưa đủ bằng chứng chuyên môn',
    )

    expect(createCatalogDiffDetails(current, source)).toContainEqual(
      expect.objectContaining({
        before: 'Ứng viên Huyết thanh: Chưa quyết định',
        after:
          'Ứng viên Huyết thanh: Từ chối - Chưa đủ bằng chứng chuyên môn',
      }),
    )
  })

  it('includes generation-only review changes', () => {
    const source = createCandidateCatalog(null, null)
    const current = createCandidateCatalog(null, null)
    source.assays[0] = {
      ...source.assays[0],
      disposition: 'configured',
      reviewReason: 'Đã rà soát',
      reviewCompatibilityGeneration: 1,
    }
    current.assays[0] = {
      ...current.assays[0],
      disposition: 'configured',
      reviewReason: 'Đã rà soát',
      reviewCompatibilityGeneration: 2,
    }

    expect(createCatalogDiffDetails(current, source)).toContainEqual(
      expect.objectContaining({
        before:
          'Có thể chỉ định - Đã rà soát - Thế hệ tương thích 1',
        after:
          'Có thể chỉ định - Đã rà soát - Thế hệ tương thích 2',
      }),
    )
  })
})
