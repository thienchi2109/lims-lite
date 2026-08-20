import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockGetAssayDefinitions = vi.fn()
const mockGetSpecialties = vi.fn()

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

vi.mock('@/components/dashboard-header', () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
}))

vi.mock('@/components/assay-definitions-table', () => ({
  AssayDefinitionsTable: () => <div data-testid="assays-table" />,
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
})
