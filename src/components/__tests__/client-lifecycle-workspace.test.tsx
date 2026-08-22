import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deactivate: vi.fn(),
  restore: vi.fn(),
  correct: vi.fn(),
  adjudicate: vi.fn(),
  getDetail: vi.fn(),
  getManager: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('@/lib/api-client', () => ({
  deactivateClientClient: (...args: unknown[]) => mocks.deactivate(...args),
  restoreClientClient: (...args: unknown[]) => mocks.restore(...args),
  correctClientIdentityClient: (...args: unknown[]) => mocks.correct(...args),
  adjudicateClientCollisionClient: (...args: unknown[]) =>
    mocks.adjudicate(...args),
  getClientLifecycleManagerClient: (...args: unknown[]) =>
    mocks.getManager(...args),
  getClientLifecycleDetailManagerClient: (...args: unknown[]) =>
    mocks.getDetail(...args),
}))

const activeClient = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Nguyễn Văn A',
  dateOfBirth: '1990-01-01',
  gender: 'Nam' as const,
  maskedIdentity: '********9012',
  maskedPhone: '******4567',
  status: 'active' as const,
  deletedAt: null,
  deletionReason: null,
  updatedAt: '2026-08-22T04:00:00.000Z',
  sampleCount: 3,
  collisionReasons: ['government_identity' as const],
  collisionCandidates: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Trần Thị B',
      maskedIdentity: '********3456',
      maskedPhone: '******4321',
      status: 'inactive' as const,
      updatedAt: '2026-08-22T04:05:00.000Z',
      evidenceLevel: 'trusted' as const,
      collisionReasons: [
        'government_identity' as const,
        'phone' as const,
      ],
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Lê Văn C',
      maskedIdentity: '********7890',
      maskedPhone: '******6789',
      status: 'active' as const,
      updatedAt: '2026-08-22T04:07:00.000Z',
      evidenceLevel: 'legacy_identity' as const,
      collisionReasons: ['phone' as const],
    },
  ],
}

const inactiveClient = {
  ...activeClient,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Trần Thị B',
  status: 'inactive' as const,
  deletedAt: '2026-08-22T03:00:00.000Z',
  deletionReason: 'Ngừng sử dụng theo hồ sơ',
  updatedAt: '2026-08-22T04:05:00.000Z',
  collisionReasons: [],
  collisionCandidates: [],
}

const initialData = {
  clients: [activeClient, inactiveClient],
  total: 2,
  activeCount: 1,
  inactiveCount: 1,
  collisionCount: 1,
}

async function loadWorkspace() {
  const filePath = join(
    process.cwd(),
    'src/components/client-lifecycle-workspace.tsx',
  )
  expect(existsSync(filePath)).toBe(true)
  if (!existsSync(filePath)) return null
  return import('@/components/client-lifecycle-workspace')
}

describe('ClientLifecycleWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deactivate.mockResolvedValue({ data: {} })
    mocks.restore.mockResolvedValue({ data: {} })
    mocks.correct.mockResolvedValue({ data: {} })
    mocks.adjudicate.mockResolvedValue({ data: {} })
    mocks.getManager.mockResolvedValue({ data: initialData })
    mocks.getDetail.mockResolvedValue({
      data: {
        id: activeClient.id,
        idCardNum: '079203009012',
        name: activeClient.name,
        dateOfBirth: activeClient.dateOfBirth,
        gender: activeClient.gender,
        phone: '0901234567',
        status: activeClient.status,
        updatedAt: activeClient.updatedAt,
      },
    })
  })

  it('renders lifecycle tabs and only masked evidence in the list', async () => {
    const workspace = await loadWorkspace()
    if (!workspace) return

    render(<workspace.ClientLifecycleWorkspace initialData={initialData} />)

    expect(screen.getByRole('tab', { name: 'Đang hoạt động 1' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: 'Ngừng hoạt động 1' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: 'Cần xử lý 1' })).not.toBeNull()
    expect(screen.getByText('********9012')).not.toBeNull()
    expect(screen.getByText('******4567')).not.toBeNull()
    expect(screen.queryByText('079203009012')).toBeNull()
    expect(screen.queryByText('0901234567')).toBeNull()
  })

  it('shows and submits a manager collision adjudication summary', async () => {
    const workspace = await loadWorkspace()
    if (!workspace) return
    const user = userEvent.setup()

    render(<workspace.ClientLifecycleWorkspace initialData={initialData} />)
    await user.click(screen.getByRole('tab', { name: 'Cần xử lý 1' }))
    await user.click(
      screen.getByRole('button', {
        name: `Xác nhận xung đột ${activeClient.name}`,
      }),
    )

    expect(screen.getByLabelText('Khách hàng liên quan')).toHaveProperty(
      'value',
      inactiveClient.id,
    )
    expect(screen.queryByRole('option', {
      name: 'Xác nhận là hai người khác nhau',
    })).toBeNull()

    await user.selectOptions(
      screen.getByLabelText('Khách hàng liên quan'),
      '33333333-3333-4333-8333-333333333333',
    )
    await user.selectOptions(
      screen.getByLabelText('Kết luận xử lý'),
      'confirmed_distinct',
    )
    await user.type(
      screen.getByLabelText('Lý do xác nhận'),
      'Hai hồ sơ thuộc hai khách hàng khác nhau',
    )

    const summary = screen.getByLabelText('Tóm tắt xác nhận xung đột')
    expect(within(summary).getByText(`Khách hàng đang xử lý: ${activeClient.name}`))
      .not.toBeNull()
    expect(within(summary).getByText('Khách hàng liên quan: Lê Văn C'))
      .not.toBeNull()
    expect(within(summary).getByText('Loại xung đột: Trùng số điện thoại'))
      .not.toBeNull()
    expect(
      within(summary).getByText('Kết luận: Xác nhận là hai người khác nhau'),
    ).not.toBeNull()
    expect(
      within(summary).getByText(
        'Lý do: Hai hồ sơ thuộc hai khách hàng khác nhau',
      ),
    ).not.toBeNull()
    expect(
      within(summary).getByText(
        'Mỗi khách hàng giữ nguyên UUID hiện tại; không gộp khách hàng và không liên kết lại lịch sử.',
      ),
    ).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Xác nhận xử lý' }))

    await waitFor(() => {
      expect(mocks.adjudicate).toHaveBeenCalledWith({
        clientId: activeClient.id,
        relatedClientId: '33333333-3333-4333-8333-333333333333',
        expectedUpdatedAt: activeClient.updatedAt,
        relatedExpectedUpdatedAt: '2026-08-22T04:07:00.000Z',
        collisionType: 'phone',
        disposition: 'confirmed_distinct',
        reason: 'Hai hồ sơ thuộc hai khách hàng khác nhau',
      })
    })
  })

  it('uses masked candidate versions without loading off-page full identity', async () => {
    const workspace = await loadWorkspace()
    if (!workspace) return
    const user = userEvent.setup()

    render(
      <workspace.ClientLifecycleWorkspace
        initialData={{
          ...initialData,
          clients: [activeClient],
          total: 1,
          inactiveCount: 0,
        }}
      />,
    )
    await user.click(screen.getByRole('tab', { name: 'Cần xử lý 1' }))
    await user.click(
      screen.getByRole('button', {
        name: `Xác nhận xung đột ${activeClient.name}`,
      }),
    )

    expect(mocks.getDetail).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Khách hàng liên quan')).toHaveProperty(
      'value',
      inactiveClient.id,
    )
  })

  it('allows confirmed-distinct adjudication for legacy government identity', async () => {
    const workspace = await loadWorkspace()
    if (!workspace) return
    const user = userEvent.setup()
    const legacyGovernmentClient = {
      ...activeClient,
      collisionCandidates: [
        {
          ...activeClient.collisionCandidates[0],
          evidenceLevel: 'legacy_identity' as const,
          collisionReasons: ['government_identity' as const],
        },
      ],
    }
    const legacyData = {
      ...initialData,
      clients: [legacyGovernmentClient],
      total: 1,
      inactiveCount: 0,
    }
    mocks.getManager.mockResolvedValue({ data: legacyData })

    render(
      <workspace.ClientLifecycleWorkspace initialData={legacyData} />,
    )
    await user.click(screen.getByRole('tab', { name: 'Cần xử lý 1' }))
    await user.click(
      screen.getByRole('button', {
        name: `Xác nhận xung đột ${legacyGovernmentClient.name}`,
      }),
    )

    expect(
      screen.getByRole('option', {
        name: 'Xác nhận là hai người khác nhau',
      }),
    ).not.toBeNull()
  })

  it('loads later lifecycle pages through the manager RPC', async () => {
    const workspace = await loadWorkspace()
    if (!workspace) return
    const user = userEvent.setup()

    render(
      <workspace.ClientLifecycleWorkspace
        initialData={{
          ...initialData,
          total: 51,
          activeCount: 51,
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))

    await waitFor(() => {
      expect(mocks.getManager).toHaveBeenCalledWith({
        status: 'active',
        search: undefined,
        limit: 50,
        offset: 50,
      })
    })
  })

  it('requires a reason and shows a confirmation summary before deactivation', async () => {
    const workspace = await loadWorkspace()
    if (!workspace) return
    const user = userEvent.setup()

    render(<workspace.ClientLifecycleWorkspace initialData={initialData} />)
    await user.click(
      screen.getByRole('button', {
        name: `Ngừng hoạt động ${activeClient.name}`,
      }),
    )

    expect(screen.getByText(/giữ nguyên UUID và toàn bộ liên kết lịch sử/i))
      .not.toBeNull()
    const confirm = screen.getByRole('button', { name: 'Xác nhận ngừng hoạt động' })
    expect(confirm).toHaveProperty('disabled', true)

    await user.type(
      screen.getByLabelText('Lý do bắt buộc'),
      'Ngừng sử dụng theo yêu cầu đã phê duyệt',
    )
    const summary = screen.getByLabelText('Tóm tắt xác nhận vòng đời')
    expect(within(summary).getByText('Trạng thái hiện tại: Đang hoạt động'))
      .not.toBeNull()
    expect(within(summary).getByText('Trạng thái sau thao tác: Ngừng hoạt động'))
      .not.toBeNull()
    expect(
      within(summary).getByText(
        'Lý do: Ngừng sử dụng theo yêu cầu đã phê duyệt',
      ),
    ).not.toBeNull()
    await user.click(confirm)

    await waitFor(() => {
      expect(mocks.deactivate).toHaveBeenCalledWith({
        clientId: activeClient.id,
        expectedUpdatedAt: activeClient.updatedAt,
        reason: 'Ngừng sử dụng theo yêu cầu đã phê duyệt',
      })
    })
  })

  it('restores the same inactive UUID with an explicit reason', async () => {
    const workspace = await loadWorkspace()
    if (!workspace) return
    const user = userEvent.setup()

    render(<workspace.ClientLifecycleWorkspace initialData={initialData} />)
    await user.click(screen.getByRole('tab', { name: 'Ngừng hoạt động 1' }))
    await user.click(
      screen.getByRole('button', {
        name: `Khôi phục ${inactiveClient.name}`,
      }),
    )
    await user.type(
      screen.getByLabelText('Lý do bắt buộc'),
      'Khôi phục theo hồ sơ đã xác minh',
    )
    const summary = screen.getByLabelText('Tóm tắt xác nhận vòng đời')
    expect(within(summary).getByText('Trạng thái hiện tại: Ngừng hoạt động'))
      .not.toBeNull()
    expect(within(summary).getByText('Trạng thái sau thao tác: Đang hoạt động'))
      .not.toBeNull()
    expect(
      within(summary).getByText('Lý do: Khôi phục theo hồ sơ đã xác minh'),
    ).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Xác nhận khôi phục' }))

    await waitFor(() => {
      expect(mocks.restore).toHaveBeenCalledWith({
        clientId: inactiveClient.id,
        expectedUpdatedAt: inactiveClient.updatedAt,
        reason: 'Khôi phục theo hồ sơ đã xác minh',
      })
    })
  })

  it('loads full identity only inside the correction dialog', async () => {
    const workspace = await loadWorkspace()
    if (!workspace) return
    const user = userEvent.setup()

    render(<workspace.ClientLifecycleWorkspace initialData={initialData} />)
    await user.click(
      screen.getByRole('button', {
        name: `Hiệu chỉnh ${activeClient.name}`,
      }),
    )

    await waitFor(() => {
      expect(mocks.getDetail).toHaveBeenCalledWith({ clientId: activeClient.id })
    })
    expect(await screen.findByDisplayValue('079203009012')).not.toBeNull()
    expect(
      screen.getByText(
        'Xác nhận cập nhật cùng UUID; không gộp khách hàng và không thay đổi liên kết mẫu/kết quả lịch sử.',
      ),
    ).not.toBeNull()
    const summary = screen.getByLabelText('Tóm tắt xác nhận hiệu chỉnh')
    expect(within(summary).getByText('Trước hiệu chỉnh')).not.toBeNull()
    expect(within(summary).getByText('Sau hiệu chỉnh')).not.toBeNull()
    expect(within(summary).getAllByText('079203009012')).toHaveLength(2)

    await user.clear(screen.getByLabelText('Số CCCD/CMND'))
    await user.type(screen.getByLabelText('Số CCCD/CMND'), '079203009013')
    await user.type(
      screen.getByLabelText('Lý do bắt buộc'),
      'Hiệu chỉnh theo giấy tờ gốc',
    )
    expect(within(summary).getByText('079203009013')).not.toBeNull()
    expect(
      within(summary).getByText('Lý do: Hiệu chỉnh theo giấy tờ gốc'),
    ).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Lưu hiệu chỉnh' }))

    await waitFor(() => {
      expect(mocks.correct).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: activeClient.id,
          expectedUpdatedAt: activeClient.updatedAt,
          idCardNum: '079203009013',
          reason: 'Hiệu chỉnh theo giấy tờ gốc',
        }),
      )
    })
  })
})
