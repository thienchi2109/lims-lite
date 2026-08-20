import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssaySampleTypeCatalogManager } from '@/types'

const mockGetCatalog = vi.fn()
const mockUpdateReview = vi.fn()
const mockReviewRevision = vi.fn()
const mockPublishRevision = vi.fn()
const mockCloneRevision = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('@/lib/api-client', () => ({
  cloneAssaySampleTypeCatalogRevisionClient: (...args: unknown[]) =>
    mockCloneRevision(...args),
  getAssaySampleTypeCatalogManagerClient: (...args: unknown[]) =>
    mockGetCatalog(...args),
  updateAssaySampleTypeCatalogReviewClient: (...args: unknown[]) =>
    mockUpdateReview(...args),
  reviewAssaySampleTypeCatalogRevisionClient: (...args: unknown[]) =>
    mockReviewRevision(...args),
  publishAssaySampleTypeCatalogRevisionClient: (...args: unknown[]) =>
    mockPublishRevision(...args),
}))

const revisionId = '11111111-1111-4111-8111-111111111111'
const serumId = '22222222-2222-4222-8222-222222222222'
const plasmaId = '33333333-3333-4333-8333-333333333333'
const glucoseId = '44444444-4444-4444-8444-444444444444'
const crpId = '55555555-5555-4555-8555-555555555555'
const inactiveId = '66666666-6666-4666-8666-666666666666'
const candidateId = '77777777-7777-4777-8777-777777777777'
const chemistryId = '88888888-8888-4888-8888-888888888888'
const immunologyId = '99999999-9999-4999-8999-999999999999'

function createCatalog(
  overrides: Partial<AssaySampleTypeCatalogManager> = {},
): AssaySampleTypeCatalogManager {
  return {
    revision: {
      id: revisionId,
      revisionNumber: 1,
      status: 'draft',
      sourceRevisionId: null,
      sourceRevisionNumber: null,
      creationReason: 'Khởi tạo catalog tương thích',
      contentHash: null,
      publishReason: null,
      publishedAt: null,
      updatedAt: '2026-08-20T09:00:00.000Z',
    },
    diff: {
      addedPairCount: 2,
      removedPairCount: 1,
      changedReviewCount: 3,
    },
    sampleTypes: [
      {
        id: serumId,
        importCode: 'LM-000001',
        name: 'Huyết thanh',
        compatibilityGeneration: 1,
        isActive: true,
      },
      {
        id: plasmaId,
        importCode: 'LM-000002',
        name: 'Huyết tương',
        compatibilityGeneration: 1,
        isActive: true,
      },
    ],
    assays: [
      {
        assayDefinitionId: glucoseId,
        importCode: 'XN-GLU',
        name: 'Glucose',
        methodName: 'Hexokinase',
        specialtyId: chemistryId,
        compatibilityGeneration: 2,
        isActive: true,
        isStale: false,
        reviewCompatibilityGeneration: null,
        disposition: null,
        reviewReason: null,
        compatibilities: [],
        candidates: [
          {
            id: candidateId,
            sampleTypeId: serumId,
            observationCount: 12,
            firstObservedAt: '2026-06-01T00:00:00.000Z',
            lastObservedAt: '2026-08-15T00:00:00.000Z',
            decision: null,
            decisionReason: null,
          },
        ],
      },
      {
        assayDefinitionId: crpId,
        importCode: 'XN-CRP',
        name: 'CRP',
        methodName: 'Miễn dịch đo độ đục',
        specialtyId: immunologyId,
        compatibilityGeneration: 1,
        isActive: true,
        isStale: false,
        reviewCompatibilityGeneration: 1,
        disposition: 'configured',
        reviewReason: 'Đã xác nhận theo SOP',
        compatibilities: [
          {
            sampleTypeId: serumId,
            provenance: 'manual',
            sourceCandidateId: null,
          },
        ],
        candidates: [],
      },
      {
        assayDefinitionId: inactiveId,
        importCode: 'XN-OLD',
        name: 'Chỉ tiêu ngừng dùng',
        methodName: null,
        specialtyId: chemistryId,
        compatibilityGeneration: 1,
        isActive: false,
        isStale: false,
        reviewCompatibilityGeneration: 1,
        disposition: 'not_assignable',
        reviewReason: 'Đã ngừng sử dụng',
        compatibilities: [],
        candidates: [
          {
            id: candidateId,
            sampleTypeId: serumId,
            observationCount: 4,
            firstObservedAt: '2025-01-01T00:00:00.000Z',
            lastObservedAt: '2025-02-01T00:00:00.000Z',
            decision: null,
            decisionReason: null,
          },
        ],
      },
    ],
    ...overrides,
  }
}

async function loadWorkspace() {
  const filePath = join(
    process.cwd(),
    'src/components/assay-sample-type-compatibility-workspace.tsx',
  )
  expect(existsSync(filePath)).toBe(true)
  if (!existsSync(filePath)) return null

  return import('@/components/assay-sample-type-compatibility-workspace')
}

describe('AssaySampleTypeCompatibilityWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCatalog.mockResolvedValue({ data: createCatalog() })
    mockUpdateReview.mockResolvedValue({ data: { revisionId } })
    mockReviewRevision.mockResolvedValue({ data: { revisionId } })
    mockPublishRevision.mockResolvedValue({ data: { revisionId } })
    mockCloneRevision.mockResolvedValue({ data: { revisionId } })
  })

  it('filters coverage by specialty and review state', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={createCatalog()}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText('Chuyên khoa'),
      chemistryId,
    )
    await user.selectOptions(
      screen.getByLabelText('Trạng thái bao phủ'),
      'candidate',
    )

    expect(screen.getAllByText('Glucose').length).toBeGreaterThan(0)
    expect(screen.queryByText('CRP')).toBeNull()
    expect(screen.queryByText('Chỉ tiêu ngừng dùng')).toBeNull()
  })

  it('shows candidate provenance and historical observation range', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={createCatalog()}
      />,
    )

    expect(screen.getByText('Nguồn: dữ liệu lịch sử')).not.toBeNull()
    expect(screen.getByText('12 lần quan sát')).not.toBeNull()
    expect(screen.getByText(/01\/06\/2026/)).not.toBeNull()
    expect(screen.getByText(/15\/08\/2026/)).not.toBeNull()
  })

  it('saves disposition, accepted candidate and review reasons', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={createCatalog()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Có thể chỉ định' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Chấp nhận ứng viên Huyết thanh',
      }),
    )
    await user.type(
      screen.getByLabelText('Lý do quyết định ứng viên Huyết thanh'),
      'Phù hợp dữ liệu lịch sử đã kiểm tra',
    )
    await user.type(
      screen.getByLabelText('Lý do đánh giá chỉ tiêu'),
      'Đã đối chiếu SOP loại mẫu',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu đánh giá' }))

    await waitFor(() => {
      expect(mockUpdateReview).toHaveBeenCalledWith({
        revisionId,
        assayDefinitionId: glucoseId,
        disposition: 'configured',
        reviewReason: 'Đã đối chiếu SOP loại mẫu',
        sampleTypeIds: [serumId],
        candidateDecisions: [
          {
            candidateId,
            decision: 'accepted',
            reason: 'Phù hợp dữ liệu lịch sử đã kiểm tra',
          },
        ],
        expectedRevisionUpdatedAt: '2026-08-20T09:00:00.000Z',
      })
    })
  })

  it('clears compatible sample types for a not-assignable disposition', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={createCatalog()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /CRP/ }))
    await user.click(screen.getByRole('button', { name: 'Không thể chỉ định' }))
    await user.clear(screen.getByLabelText('Lý do đánh giá chỉ tiêu'))
    await user.type(
      screen.getByLabelText('Lý do đánh giá chỉ tiêu'),
      'Không có loại mẫu phù hợp',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu đánh giá' }))

    await waitFor(() => {
      expect(mockUpdateReview).toHaveBeenCalledWith(
        expect.objectContaining({
          assayDefinitionId: crpId,
          disposition: 'not_assignable',
          sampleTypeIds: [],
        }),
      )
    })
  })

  it('preserves not-assignable when rejecting every historical candidate', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={createCatalog()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Không thể chỉ định' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Từ chối ứng viên Huyết thanh',
      }),
    )
    await user.type(
      screen.getByLabelText('Lý do quyết định ứng viên Huyết thanh'),
      'Chưa đủ bằng chứng chuyên môn',
    )
    await user.type(
      screen.getByLabelText('Lý do đánh giá chỉ tiêu'),
      'Chưa có loại mẫu đã xác nhận',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu đánh giá' }))

    await waitFor(() => {
      expect(mockUpdateReview).toHaveBeenCalledWith(
        expect.objectContaining({
          assayDefinitionId: glucoseId,
          disposition: 'not_assignable',
          sampleTypeIds: [],
          candidateDecisions: [
            {
              candidateId,
              decision: 'rejected',
              reason: 'Chưa đủ bằng chứng chuyên môn',
            },
          ],
        }),
      )
    })
  })

  it('clears the candidate reason when reversing a decision', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()
    const catalog = createCatalog({
      assays: createCatalog().assays.map((assay) =>
        assay.assayDefinitionId === glucoseId
          ? {
              ...assay,
              disposition: 'configured',
              reviewReason: 'Đã đánh giá',
              reviewCompatibilityGeneration: 2,
              compatibilities: [{
                sampleTypeId: serumId,
                provenance: 'historical_candidate',
                sourceCandidateId: candidateId,
              }],
              candidates: assay.candidates.map((candidate) => ({
                ...candidate,
                decision: 'accepted',
                decisionReason: 'Bằng chứng cũ',
              })),
            }
          : assay,
      ),
    })

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={catalog}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Từ chối ứng viên Huyết thanh',
      }),
    )

    expect(
      (
        screen.getByLabelText(
          'Lý do quyết định ứng viên Huyết thanh',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('')
  })

  it('filters assays that require lifecycle review', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()
    const catalog = createCatalog({
      assays: createCatalog().assays.map((assay) => ({
        ...assay,
        isStale: assay.assayDefinitionId === crpId,
      })),
    })

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={catalog}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText('Trạng thái bao phủ'),
      'stale',
    )

    expect(screen.getAllByText('CRP').length).toBeGreaterThan(0)
    expect(screen.getByText('Cần rà soát lại')).not.toBeNull()
    expect(screen.queryByText('Glucose')).toBeNull()
  })

  it('shows the draft diff and requires a publish reason', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()
    const reviewedCatalog = createCatalog({
      revision: {
        ...createCatalog().revision!,
        contentHash:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    })

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={reviewedCatalog}
      />,
    )

    expect(screen.getByText('Thêm 2 cặp')).not.toBeNull()
    expect(screen.getByText('Bỏ 1 cặp')).not.toBeNull()
    expect(screen.getByText('Thay đổi 3 đánh giá')).not.toBeNull()
    expect(screen.getByText(/Chi tiết thay đổi/)).not.toBeNull()
    expect(screen.getByText('Thêm Huyết thanh')).not.toBeNull()
    expect(
      screen.getByText(/Có thể chỉ định - Đã xác nhận theo SOP/),
    ).not.toBeNull()

    await user.click(
      screen.getByLabelText('Tôi đã kiểm tra chi tiết thay đổi'),
    )
    await user.click(
      screen.getByRole('button', { name: 'Xuất bản phiên bản 1' }),
    )
    expect(screen.getByText('Vui lòng nhập lý do xuất bản')).not.toBeNull()
    expect(mockPublishRevision).not.toHaveBeenCalled()

    await user.type(
      screen.getByLabelText('Lý do xuất bản'),
      'Hoàn tất review coverage revision 1',
    )
    await user.click(
      screen.getByRole('button', { name: 'Xuất bản phiên bản 1' }),
    )

    await waitFor(() => {
      expect(mockPublishRevision).toHaveBeenCalledWith({
        revisionId,
        expectedRevisionUpdatedAt: '2026-08-20T09:00:00.000Z',
        publishReason: 'Hoàn tất review coverage revision 1',
      })
    })
  })

  it('reviews the current draft before publication', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={createCatalog()}
      />,
    )

    await user.click(
      screen.getByLabelText('Tôi đã kiểm tra chi tiết thay đổi'),
    )
    await user.click(screen.getByRole('button', { name: 'Xác nhận bản nháp' }))

    await waitFor(() => {
      expect(mockReviewRevision).toHaveBeenCalledWith({
        revisionId,
        expectedRevisionUpdatedAt: '2026-08-20T09:00:00.000Z',
      })
    })
    expect(mockGetCatalog).toHaveBeenCalledWith({ revisionId })
  })

  it('requires a fresh diff acknowledgement after the draft token changes', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()
    mockGetCatalog.mockResolvedValueOnce({
      data: createCatalog({
        revision: {
          ...createCatalog().revision!,
          contentHash:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          updatedAt: '2026-08-20T09:05:00.000Z',
        },
      }),
    })

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={createCatalog()}
      />,
    )

    await user.click(
      screen.getByLabelText('Tôi đã kiểm tra chi tiết thay đổi'),
    )
    await user.click(screen.getByRole('button', { name: 'Xác nhận bản nháp' }))

    await waitFor(() => {
      expect(
        screen
          .getByLabelText('Tôi đã kiểm tra chi tiết thay đổi')
          .getAttribute('data-state'),
      ).toBe('unchecked')
    })
    expect(
      screen
        .getByRole('button', { name: 'Xuất bản phiên bản 1' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('prevents adding an inactive sample type', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const catalog = createCatalog({
      sampleTypes: createCatalog().sampleTypes.map((sampleType) => ({
        ...sampleType,
        isActive: sampleType.id !== plasmaId,
      })),
    })

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={catalog}
      />,
    )

    expect(
      screen
        .getByRole('checkbox', { name: /Huyết tương/ })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('allows rejecting and saving inactive candidates without configuring pairs', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={createCatalog()}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText('Trạng thái bao phủ'),
      'inactive',
    )

    expect(
      screen
        .getByRole('button', { name: 'Có thể chỉ định' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByRole('checkbox', { name: /Huyết thanh/ })
        .hasAttribute('disabled'),
    ).toBe(true)

    await user.click(
      screen.getByRole('button', { name: 'Từ chối ứng viên Huyết thanh' }),
    )
    await user.type(
      screen.getByLabelText('Lý do quyết định ứng viên Huyết thanh'),
      'Chỉ tiêu đã ngừng dùng',
    )
    await user.clear(screen.getByLabelText('Lý do đánh giá chỉ tiêu'))
    await user.type(
      screen.getByLabelText('Lý do đánh giá chỉ tiêu'),
      'Dọn ứng viên của chỉ tiêu đã ngừng dùng',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu đánh giá' }))

    await waitFor(() => {
      expect(mockUpdateReview).toHaveBeenCalledWith(
        expect.objectContaining({
          assayDefinitionId: inactiveId,
          disposition: 'not_assignable',
          reviewReason: 'Dọn ứng viên của chỉ tiêu đã ngừng dùng',
          sampleTypeIds: [],
          candidateDecisions: [
            {
              candidateId,
              decision: 'rejected',
              reason: 'Chỉ tiêu đã ngừng dùng',
            },
          ],
        }),
      )
    })
  })

  it('renders a published revision as read-only', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const baseCatalog = createCatalog()
    const catalog = createCatalog({
      revision: {
        ...baseCatalog.revision!,
        status: 'published',
        contentHash:
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        publishReason: 'Đã phê duyệt',
        publishedAt: '2026-08-20T10:00:00.000Z',
      },
    })

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={catalog}
      />,
    )

    expect(
      screen
        .getByRole('button', { name: 'Lưu đánh giá' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Xác nhận bản nháp' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', {
        name: 'Tạo bản nháp từ phiên bản 1',
      }),
    ).not.toBeNull()
  })

  it('requires a reason before cloning a published revision', async () => {
    const workspaceModule = await loadWorkspace()
    if (!workspaceModule) return
    const user = userEvent.setup()
    const baseCatalog = createCatalog()
    const catalog = createCatalog({
      revision: {
        ...baseCatalog.revision!,
        status: 'published',
        contentHash:
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        publishReason: 'Đã phê duyệt',
        publishedAt: '2026-08-20T10:00:00.000Z',
      },
    })

    render(
      <workspaceModule.AssaySampleTypeCompatibilityWorkspace
        initialCatalog={catalog}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Tạo bản nháp từ phiên bản 1',
      }),
    )
    expect(screen.getByText('Vui lòng nhập lý do tạo bản nháp')).not.toBeNull()
    expect(mockCloneRevision).not.toHaveBeenCalled()

    await user.type(
      screen.getByLabelText('Lý do tạo bản nháp'),
      'Rà soát thay đổi phương pháp',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Tạo bản nháp từ phiên bản 1',
      }),
    )

    await waitFor(() => {
      expect(mockCloneRevision).toHaveBeenCalledWith({
        sourceRevisionNumber: 1,
        creationReason: 'Rà soát thay đổi phương pháp',
      })
    })
    expect(mockRefresh).toHaveBeenCalled()
  })
})
