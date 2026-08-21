import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assignTestsClient: vi.fn(),
  fetchAssayDefinitionsClient: vi.fn(),
  getPublishedCatalogClient: vi.fn(),
  toastError: vi.fn(),
}))

const sampleType = {
  id: '11111111-1111-4111-8111-111111111111',
  importCode: 'LM-000001',
  name: 'Máu',
}

vi.mock('@/lib/api-client', () => ({
  assignTestsClient: mocks.assignTestsClient,
  fetchAssayDefinitionsClient: mocks.fetchAssayDefinitionsClient,
  getPublishedAssaySampleTypeCatalogClient: mocks.getPublishedCatalogClient,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

import { TestAssignmentModule } from '../test-assignment-module'

function renderModule(sampleTypeId: string | null = sampleType.id) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TestAssignmentModule
        sampleId="22222222-2222-4222-8222-222222222222"
        sampleTypeId={sampleTypeId}
        sampleStatus="received"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

describe('TestAssignmentModule compatibility catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPublishedCatalogClient.mockResolvedValue({
      data: {
        revisionNumber: 7,
        sampleTypeId: null,
        sampleTypes: [sampleType],
        assays: [{
          sampleTypeId: sampleType.id,
          assayDefinitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          importCode: 'CT-000001',
          name: 'ALT',
          methodName: 'Máy tự động',
          specialtyId: null,
        }],
      },
    })
    mocks.fetchAssayDefinitionsClient.mockResolvedValue({
      data: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'ALT',
          import_code: 'CT-000001',
          specialty_id: null,
          default_method_id: 'method-1',
          methods: [{
            method_id: 'method-1',
            name: 'Máy tự động',
            is_default: true,
          }],
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Chỉ tiêu không tương thích',
          import_code: 'CT-000002',
          specialty_id: null,
          default_method_id: 'method-2',
          methods: [{
            method_id: 'method-2',
            name: 'Thủ công',
            is_default: true,
          }],
        },
      ],
    })
    mocks.assignTestsClient.mockResolvedValue({
      data: { inserted_count: 1 },
    })
  })

  it('hides incompatible assays and submits the revision-bound v2 payload', async () => {
    renderModule()

    const compatibleAssay = await screen.findByText('ALT')
    expect(screen.queryByText('Chỉ tiêu không tương thích')).toBeNull()
    expect(mocks.fetchAssayDefinitionsClient).toHaveBeenCalledWith({
      search: '',
      pageSize: 2000,
      specialtyId: 'all',
    })

    fireEvent.click(compatibleAssay)
    fireEvent.click(screen.getByRole('button', { name: 'Chỉ định (1)' }))

    await waitFor(() => {
      expect(mocks.assignTestsClient).toHaveBeenCalledWith({
        sampleId: '22222222-2222-4222-8222-222222222222',
        sampleTypeId: sampleType.id,
        sampleTypeCode: sampleType.importCode,
        expectedRevisionNumber: 7,
        tests: [{
          assayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          methodId: 'method-1',
        }],
      })
    })
  })

  it('clears the selection and reloads the catalog after a stale assignment error', async () => {
    mocks.assignTestsClient.mockRejectedValue(new Error(
      'Dữ liệu chỉ định đã cũ. Vui lòng tải lại trang và chọn lại loại mẫu.',
    ))
    renderModule()

    fireEvent.click(await screen.findByText('ALT'))
    fireEvent.click(screen.getByRole('button', { name: 'Chỉ định (1)' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Dữ liệu chỉ định đã cũ. Vui lòng tải lại trang và chọn lại loại mẫu.',
      )
      expect(mocks.toastError).not.toHaveBeenCalledWith(
        expect.stringContaining('P1105'),
      )
      expect(mocks.getPublishedCatalogClient).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('button', { name: 'Chỉ định (0)' })).toHaveProperty(
        'disabled',
        true,
      )
    })
  })

  it('fails closed for a legacy sample without a sample-type id', async () => {
    renderModule(null)

    expect(await screen.findByText(
      'Dữ liệu chỉ định đã cũ. Vui lòng tải lại trang và chọn lại loại mẫu.',
    )).toBeDefined()
    expect(mocks.fetchAssayDefinitionsClient).not.toHaveBeenCalled()
    expect(mocks.assignTestsClient).not.toHaveBeenCalled()
  })
})
