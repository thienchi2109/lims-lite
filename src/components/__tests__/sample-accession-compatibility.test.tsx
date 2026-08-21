import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  accessionAndAssignTestsClient: vi.fn(),
  createSampleClient: vi.fn(),
  getPublishedCatalogClient: vi.fn(),
  printSampleBarcodeLabel: vi.fn(),
  toastInfo: vi.fn(),
}))

const bloodType = {
  id: '11111111-1111-4111-8111-111111111111',
  importCode: 'LM-000001',
  name: 'Máu',
}

const urineType = {
  id: '22222222-2222-4222-8222-222222222222',
  importCode: 'LM-000002',
  name: 'Nước tiểu',
}

function createCatalog(revisionNumber = 7) {
  return {
    data: {
      revisionNumber,
      sampleTypeId: null,
      sampleTypes: [bloodType, urineType],
      assays: [
        {
          sampleTypeId: bloodType.id,
          assayDefinitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          importCode: 'CT-000001',
          name: 'ALT',
          methodName: 'Máy tự động',
          specialtyId: null,
        },
        {
          sampleTypeId: urineType.id,
          assayDefinitionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          importCode: 'CT-000002',
          name: 'Protein niệu',
          methodName: 'Que thử',
          specialtyId: null,
        },
      ],
    },
  }
}

vi.mock('@/lib/api-client', () => ({
  accessionAndAssignTestsClient: mocks.accessionAndAssignTestsClient,
  createSampleClient: mocks.createSampleClient,
  findClientByIdentityClient: vi.fn(),
  getPublishedAssaySampleTypeCatalogClient: mocks.getPublishedCatalogClient,
}))

vi.mock('@/lib/sample-label-print-client', () => ({
  printSampleBarcodeLabel: mocks.printSampleBarcodeLabel,
}))

vi.mock('@/components/sample-accession-context', () => ({
  SampleAccessionContext: (props: {
    onSelectClient: (client: unknown) => void
    onSampleQualityChange: (value: boolean) => void
    sampleTypes?: typeof bloodType[]
    selectedSampleTypeId?: string | null
    onSampleTypeChange?: (sampleTypeId: string) => void
    revisionNumber?: number | null
    onReloadCompatibility?: () => void
    submitError?: string | null
  }) => (
    <div>
      <button
        type="button"
        onClick={() => props.onSelectClient({
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Nguyễn Văn A',
        })}
      >
        Chọn khách hàng
      </button>
      <button type="button" onClick={() => props.onSampleQualityChange(true)}>
        Chọn mẫu đạt
      </button>
      <div data-testid="catalog-revision">{props.revisionNumber ?? ''}</div>
      <div data-testid="selected-sample-type-id">{props.selectedSampleTypeId ?? ''}</div>
      <div data-testid="compatibility-error">{props.submitError ?? ''}</div>
      {props.sampleTypes?.map((sampleType) => (
        <button
          key={sampleType.id}
          type="button"
          onClick={() => props.onSampleTypeChange?.(sampleType.id)}
        >
          Chọn {sampleType.name}
        </button>
      ))}
      <button type="button" onClick={props.onReloadCompatibility}>
        Tải lại catalog
      </button>
    </div>
  ),
}))

vi.mock('@/components/test-assignment-grid', () => ({
  TestAssignmentGrid: (props: {
    selected: Array<{ assayId: string }>
    onChange: (tests: Array<{
      assayId: string
      methodId: string
      assayName: string
      methodName: string
      units: string
    }>) => void
    allowedAssayIds?: string[]
    onSave: () => void
    context?: React.ReactNode
  }) => (
    <div>
      <div data-testid="allowed-assay-ids">
        {(props.allowedAssayIds ?? []).join(',')}
      </div>
      <div data-testid="selected-count">{props.selected.length}</div>
      <button
        type="button"
        onClick={() => props.onChange([{
          assayId: props.allowedAssayIds?.[0] ?? 'incompatible-assay',
          methodId: 'method-1',
          assayName: 'Chỉ tiêu',
          methodName: 'Phương pháp',
          units: 'U/L',
        }])}
      >
        Thêm chỉ tiêu tương thích
      </button>
      <button type="button" onClick={props.onSave}>
        Lưu mẫu
      </button>
      {props.context}
    </div>
  ),
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/qr/parse-client-identity-qr', () => ({
  parseClientIdentityQr: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: mocks.toastInfo,
    success: vi.fn(),
  },
}))

import { SampleAccessionForm } from '../sample-accession-form'

describe('SampleAccessionForm compatibility catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPublishedCatalogClient.mockResolvedValue(createCatalog())
    mocks.accessionAndAssignTestsClient.mockResolvedValue({
      data: {
        sample: { id: 'sample-1', sample_id: 'SMP-001' },
        results: [{ id: 'result-1' }],
      },
    })
  })

  it('filters assays by sample type and submits the exact revision-bound payload', async () => {
    render(<SampleAccessionForm specialties={[]} />)

    await screen.findByRole('button', { name: 'Chọn Máu' })
    fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chọn mẫu đạt' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chọn Máu' }))

    expect(screen.getByTestId('allowed-assay-ids').textContent).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Thêm chỉ tiêu tương thích' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

    await waitFor(() => {
      expect(mocks.accessionAndAssignTestsClient).toHaveBeenCalledWith({
        client_id: '33333333-3333-4333-8333-333333333333',
        client_name: 'Nguyễn Văn A',
        type: 'Máu',
        sample_quality: true,
        received_at: undefined,
        tests: [{
          assayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          methodId: 'method-1',
        }],
        sampleTypeId: bloodType.id,
        sampleTypeCode: bloodType.importCode,
        expectedRevisionNumber: 7,
      })
    })
  })

  it('resets selected assays when the sample type changes', async () => {
    render(<SampleAccessionForm specialties={[]} />)

    await screen.findByRole('button', { name: 'Chọn Máu' })
    fireEvent.click(screen.getByRole('button', { name: 'Chọn Máu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Thêm chỉ tiêu tương thích' }))
    expect(screen.getByTestId('selected-count').textContent).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))

    expect(screen.getByTestId('selected-count').textContent).toBe('0')
    expect(mocks.toastInfo).toHaveBeenCalledWith(
      'Danh sách chỉ tiêu đã được cập nhật theo loại mẫu đã chọn.',
    )
    expect(screen.getByTestId('allowed-assay-ids').textContent).toBe(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    )
  })

  it('reloads a newer revision and clears selections from the previous revision', async () => {
    mocks.getPublishedCatalogClient
      .mockResolvedValueOnce(createCatalog(7))
      .mockResolvedValueOnce(createCatalog(8))

    render(<SampleAccessionForm specialties={[]} />)

    await waitFor(() => {
      expect(screen.getByTestId('catalog-revision').textContent).toBe('7')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm chỉ tiêu tương thích' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại catalog' }))

    await waitFor(() => {
      expect(screen.getByTestId('catalog-revision').textContent).toBe('8')
    })
    await waitFor(() => {
      expect(screen.getByTestId('selected-count').textContent).toBe('0')
    })
  })
})
