import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockGetAssayDefinitions = vi.fn()
const mockGetSpecialties = vi.fn()
const mockGetCatalog = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({ single: mockSingle }),
      }),
    }),
  }),
}))

vi.mock('@/app/actions/assay-queries', () => ({
  getAssayDefinitions: (...args: unknown[]) =>
    mockGetAssayDefinitions(...args),
}))

vi.mock('@/app/actions/assay-lookups', () => ({
  getSpecialties: (...args: unknown[]) => mockGetSpecialties(...args),
}))

vi.mock('@/app/actions/assay-sample-type-compatibility', () => ({
  getAssaySampleTypeCatalogManager: (...args: unknown[]) =>
    mockGetCatalog(...args),
}))

vi.mock('@/components/dashboard-header', () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
}))

vi.mock('@/components/assay-definitions-table', () => ({
  AssayDefinitionsTable: ({
    compatibilityUnavailable,
  }: {
    compatibilityUnavailable?: boolean
  }) => (
    <div data-testid="compatibility-state">
      {compatibilityUnavailable ? 'Không thể tải trạng thái tương thích' : 'Sẵn sàng'}
    </div>
  ),
}))

describe('AssaysPage compatibility navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
    })
    mockSingle.mockResolvedValue({
      data: { full_name: 'Phụ trách chuyên môn', role: 'manager' },
    })
    mockGetAssayDefinitions.mockResolvedValue({
      data: [],
      totalCount: 0,
      totalPages: 1,
      error: null,
    })
    mockGetSpecialties.mockResolvedValue({ data: [] })
    mockGetCatalog.mockResolvedValue({ data: null })
  })

  it('links managers to the Vietnamese compatibility workspace', async () => {
    const pageModule = await import('./page')

    render(
      await pageModule.default({
        searchParams: Promise.resolve({}),
      }),
    )

    expect(
      screen.getByRole('link', { name: 'Tương thích loại mẫu' }).getAttribute(
        'href',
      ),
    ).toBe('/manager/assays/compatibility')
  })

  it('marks compatibility status unavailable when the manager catalog fails', async () => {
    mockGetCatalog.mockResolvedValue({ error: 'Không thể tải catalog' })
    const pageModule = await import('./page')

    render(
      await pageModule.default({
        searchParams: Promise.resolve({}),
      }),
    )

    expect(screen.getByTestId('compatibility-state').textContent).toBe(
      'Không thể tải trạng thái tương thích',
    )
  })
})
