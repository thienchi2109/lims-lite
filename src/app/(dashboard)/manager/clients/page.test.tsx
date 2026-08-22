import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockGetLifecycle = vi.fn()

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

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))

vi.mock('@/app/actions/client-lifecycle', () => ({
  getClientLifecycleManager: (...args: unknown[]) =>
    mockGetLifecycle(...args),
}))

vi.mock('@/components/dashboard-header', () => ({
  DashboardHeader: ({ subtitle }: { subtitle: string }) => (
    <div data-testid="dashboard-header">{subtitle}</div>
  ),
}))

vi.mock('@/components/client-lifecycle-workspace', () => ({
  ClientLifecycleWorkspace: () => (
    <div data-testid="client-lifecycle-workspace" />
  ),
}))

async function loadPage() {
  const filePath = join(
    process.cwd(),
    'src/app/(dashboard)/manager/clients/page.tsx',
  )
  expect(existsSync(filePath)).toBe(true)
  if (!existsSync(filePath)) return null
  return import('./page')
}

describe('client lifecycle manager page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
    })
    mockGetLifecycle.mockResolvedValue({
      data: {
        clients: [],
        total: 0,
        activeCount: 0,
        inactiveCount: 0,
        collisionCount: 0,
      },
    })
  })

  it('redirects an Analyst before reading lifecycle data', async () => {
    mockSingle.mockResolvedValue({
      data: { full_name: 'Phân tích viên', role: 'analyst' },
    })
    const pageModule = await loadPage()
    if (!pageModule) return

    await expect(pageModule.default()).rejects.toThrow('redirect:/manager')
    expect(mockGetLifecycle).not.toHaveBeenCalled()
  })

  it('renders the Vietnamese manager workspace', async () => {
    mockSingle.mockResolvedValue({
      data: { full_name: 'Phụ trách chuyên môn', role: 'manager' },
    })
    const pageModule = await loadPage()
    if (!pageModule) return

    render(await pageModule.default())

    expect(
      screen.getByRole('heading', { name: 'Vòng đời khách hàng' }),
    ).not.toBeNull()
    expect(screen.getByTestId('client-lifecycle-workspace')).not.toBeNull()
    expect(mockGetLifecycle).toHaveBeenCalledWith({
      status: 'active',
      limit: 50,
      offset: 0,
    })
  })
})
