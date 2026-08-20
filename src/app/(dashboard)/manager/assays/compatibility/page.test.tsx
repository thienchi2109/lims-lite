import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockGetCatalog = vi.fn()
const mockGetSpecialties = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))

vi.mock('@/app/actions/assay-sample-type-compatibility', () => ({
  getAssaySampleTypeCatalogManager: (...args: unknown[]) =>
    mockGetCatalog(...args),
}))

vi.mock('@/app/actions/assay-lookups', () => ({
  getSpecialties: (...args: unknown[]) => mockGetSpecialties(...args),
}))

vi.mock('@/components/dashboard-header', () => ({
  DashboardHeader: ({ subtitle }: { subtitle: string }) => (
    <div data-testid="dashboard-header">{subtitle}</div>
  ),
}))

vi.mock('@/components/assay-sample-type-compatibility-workspace', () => ({
  AssaySampleTypeCompatibilityWorkspace: ({
    sourceCatalog,
  }: {
    sourceCatalog?: { revision: { revisionNumber: number } | null } | null
  }) => (
    <div
      data-testid="compatibility-workspace"
      data-source-revision={sourceCatalog?.revision?.revisionNumber}
    />
  ),
}))

async function loadPage() {
  const filePath = join(
    process.cwd(),
    'src/app/(dashboard)/manager/assays/compatibility/page.tsx',
  )
  expect(existsSync(filePath)).toBe(true)
  if (!existsSync(filePath)) return null

  return import('./page')
}

describe('Assay compatibility manager page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSpecialties.mockResolvedValue({ data: [] })
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
    })
  })

  it('redirects an Analyst before reading the draft catalog', async () => {
    mockSingle.mockResolvedValue({
      data: { full_name: 'Phân tích viên', role: 'analyst' },
    })
    const pageModule = await loadPage()
    if (!pageModule) return

    await expect(pageModule.default()).rejects.toThrow('redirect:/manager')
    expect(mockGetCatalog).not.toHaveBeenCalled()
  })

  it('loads the Manager workspace with Vietnamese UI', async () => {
    mockSingle.mockResolvedValue({
      data: { full_name: 'Phụ trách chuyên môn', role: 'manager' },
    })
    mockGetCatalog.mockResolvedValue({
      data: {
        revision: null,
        diff: {
          addedPairCount: 0,
          removedPairCount: 0,
          changedReviewCount: 0,
        },
        sampleTypes: [],
        assays: [],
      },
    })
    const pageModule = await loadPage()
    if (!pageModule) return

    render(await pageModule.default())

    expect(
      screen.getByRole('heading', {
        name: 'Quản lý tương thích loại mẫu',
      }),
    ).not.toBeNull()
    expect(screen.getByTestId('compatibility-workspace')).not.toBeNull()
  })

  it('loads the source revision for an itemized draft diff', async () => {
    mockSingle.mockResolvedValue({
      data: { full_name: 'Phụ trách chuyên môn', role: 'manager' },
    })
    const sourceRevisionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    mockGetCatalog
      .mockResolvedValueOnce({
        data: {
          revision: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            revisionNumber: 2,
            status: 'draft',
            sourceRevisionId,
            sourceRevisionNumber: 1,
            creationReason: 'Điều chỉnh catalog',
            contentHash: null,
            publishReason: null,
            publishedAt: null,
            updatedAt: '2026-08-20T09:00:00.000Z',
          },
          diff: {
            addedPairCount: 0,
            removedPairCount: 0,
            changedReviewCount: 0,
          },
          sampleTypes: [],
          assays: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          revision: {
            id: sourceRevisionId,
            revisionNumber: 1,
            status: 'published',
            sourceRevisionId: null,
            sourceRevisionNumber: null,
            creationReason: 'Khởi tạo catalog',
            contentHash:
              'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            publishReason: 'Xuất bản lần đầu',
            publishedAt: '2026-08-20T08:00:00.000Z',
            updatedAt: '2026-08-20T08:00:00.000Z',
          },
          diff: {
            addedPairCount: 0,
            removedPairCount: 0,
            changedReviewCount: 0,
          },
          sampleTypes: [],
          assays: [],
        },
      })
    const pageModule = await loadPage()
    if (!pageModule) return

    render(await pageModule.default())

    expect(mockGetCatalog).toHaveBeenNthCalledWith(2, {
      revisionId: sourceRevisionId,
    })
    expect(
      screen.getByTestId('compatibility-workspace').getAttribute(
        'data-source-revision',
      ),
    ).toBe('1')
  })

  it('fails closed when the source revision cannot be loaded', async () => {
    mockSingle.mockResolvedValue({
      data: { full_name: 'Phụ trách chuyên môn', role: 'manager' },
    })
    const sourceRevisionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    mockGetCatalog
      .mockResolvedValueOnce({
        data: {
          revision: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            revisionNumber: 2,
            status: 'draft',
            sourceRevisionId,
            sourceRevisionNumber: 1,
            creationReason: 'Điều chỉnh catalog',
            contentHash: null,
            publishReason: null,
            publishedAt: null,
            updatedAt: '2026-08-20T09:00:00.000Z',
          },
          diff: {
            addedPairCount: 0,
            removedPairCount: 0,
            changedReviewCount: 0,
          },
          sampleTypes: [],
          assays: [],
        },
      })
      .mockResolvedValueOnce({ error: 'Không thể tải phiên bản nguồn' })
    const pageModule = await loadPage()
    if (!pageModule) return

    render(await pageModule.default())

    expect(screen.queryByTestId('compatibility-workspace')).toBeNull()
    expect(
      screen.getByText('Không thể tải dữ liệu tương thích loại mẫu.'),
    ).not.toBeNull()
  })
})
