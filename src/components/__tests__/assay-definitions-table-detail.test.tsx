import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssayDefinitionsTable } from '../assay-definitions-table'
import type { AssayDefinition } from '../assay-definition-dialog/types'
import type { LabSpecialty } from '@/types'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  createAssayDefinitionClient: vi.fn(),
  updateAssayDefinitionClient: vi.fn(),
  fetchMethodNameSuggestionsClient: vi.fn(),
  createLabSpecialty: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/manager/assays',
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('sonner', () => ({
  toast: mocks.toast,
}))

vi.mock('@/lib/api-client', () => ({
  createAssayDefinitionClient: (...args: unknown[]) => mocks.createAssayDefinitionClient(...args),
  updateAssayDefinitionClient: (...args: unknown[]) => mocks.updateAssayDefinitionClient(...args),
  fetchMethodNameSuggestionsClient: (...args: unknown[]) => mocks.fetchMethodNameSuggestionsClient(...args),
}))

vi.mock('@/app/actions/lab-specialties', () => ({
  createLabSpecialty: (...args: unknown[]) => mocks.createLabSpecialty(...args),
}))

vi.mock('../assay-definition-dialog/specialty-field', () => ({
  SpecialtyField: ({
    form,
    specialties,
  }: {
    form: { watch: (name: 'specialtyId') => string; setValue: (name: 'specialtyId', value: string) => void }
    specialties: LabSpecialty[]
  }) => (
    <label>
      Nhóm kỹ thuật
      <select
        value={form.watch('specialtyId')}
        onChange={(event) => form.setValue('specialtyId', event.target.value)}
      >
        <option value="">Chọn Nhóm kỹ thuật</option>
        {specialties.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  ),
}))

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const specialty: LabSpecialty = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'IMM',
  name: 'Miễn dịch',
  display_order: 1,
  description: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
}

const assay: AssayDefinition = {
  id: 'assay-1',
  import_code: 'CT-000123',
  name: 'HIV Ag/Ab',
  specialty_id: specialty.id,
  method_name: 'RT-PCR',
  units: 'Index',
  is_confidential: true,
  validation_rules: { type: 'numeric', required: true },
  methods: [
    {
      id: 'assay-method-1',
      method_id: 'method-1',
      name: 'ELISA',
      is_default: true,
      notes: null,
    },
  ],
}

describe('AssayDefinitionsTable detail action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchMethodNameSuggestionsClient.mockResolvedValue({ data: [] })
  })

  it('opens the shared read-only detail dialog from the row action', () => {
    render(
      <AssayDefinitionsTable
        assays={[assay]}
        page={1}
        pageSize={10}
        totalPages={1}
        totalCount={1}
        specialties={[specialty]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết chỉ tiêu' }))

    expect(screen.getByText('Chi tiết chỉ tiêu xét nghiệm')).toBeDefined()
    expect(screen.getAllByText('HIV Ag/Ab').length).toBeGreaterThan(0)
    expect(screen.getAllByText('RT-PCR').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Cập nhật' })).toBeNull()
  })

  it('shows persisted assay-owned method text in the manager table', () => {
    render(
      <AssayDefinitionsTable
        assays={[assay]}
        page={1}
        pageSize={10}
        totalPages={1}
        totalCount={1}
        specialties={[specialty]}
      />,
    )

    expect(screen.getByText('Phương pháp/Thiết bị')).toBeDefined()
    expect(screen.getByText('RT-PCR')).toBeDefined()
  })

  it('shows the published compatibility status in the manager read table', () => {
    render(
      <AssayDefinitionsTable
        assays={[assay]}
        page={1}
        pageSize={10}
        totalPages={1}
        totalCount={1}
        specialties={[specialty]}
        compatibilityByAssayId={{
          [assay.id]: {
            disposition: 'configured',
            isStale: false,
            compatibleSampleTypeCount: 2,
          },
        }}
        compatibilityRevisionNumber={7}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Tương thích loại mẫu' })).toBeDefined()
    expect(screen.getByText('2 loại mẫu')).toBeDefined()
    expect(screen.getByText(/Phiên bản 7/)).toBeDefined()
  })

  it('shows the server-provided assay code in a stable, horizontally scrollable column', () => {
    render(
      <AssayDefinitionsTable
        assays={[assay]}
        page={1}
        pageSize={10}
        totalPages={1}
        totalCount={1}
        specialties={[specialty]}
      />,
    )

    const codeHeader = screen.getByRole('columnheader', { name: 'Mã chỉ tiêu' })
    expect(codeHeader.className).toContain('w-[132px]')
    expect(codeHeader.className).toContain('min-w-[132px]')
    expect(codeHeader.className).toContain('max-w-[132px]')

    const codeCell = screen.getByText('CT-000123').closest('td')
    expect(codeCell?.className).toContain('font-mono')
    expect(codeCell?.className).toContain('tabular-nums')
    expect(document.querySelector('[data-slot="table-container"]')?.className).toContain('overflow-x-auto')
    expect(screen.getByText('Trang 1 / 1')).toBeDefined()
  })

  it('keeps the returned import code in local table state after creating an assay', async () => {
    const createdAssay: AssayDefinition = {
      ...assay,
      id: 'assay-2',
      import_code: 'CT-000124',
      name: 'HIV RNA',
      method_name: 'RT-PCR',
    }
    mocks.createAssayDefinitionClient.mockResolvedValue({ data: createdAssay })

    render(
      <AssayDefinitionsTable
        assays={[assay]}
        page={1}
        pageSize={10}
        totalPages={1}
        totalCount={1}
        specialties={[specialty]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))
    expect(screen.queryByLabelText('Mã chỉ tiêu')).toBeNull()
    fireEvent.change(screen.getByLabelText(/Tên chỉ tiêu/i), {
      target: { value: createdAssay.name },
    })
    fireEvent.change(screen.getByLabelText(/Nhóm kỹ thuật/i), {
      target: { value: specialty.id },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Phương pháp/i }), {
      target: { value: createdAssay.method_name },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))

    await waitFor(() => {
      expect(screen.getByText('CT-000124')).toBeDefined()
    })
    expect(mocks.createAssayDefinitionClient.mock.calls[0][0]).not.toHaveProperty('import_code')
  })

  it('preserves the import code in local table state after updating an assay', async () => {
    const updatedAssay: AssayDefinition = {
      ...assay,
      name: 'HIV Ag/Ab thế hệ 4',
    }
    mocks.updateAssayDefinitionClient.mockResolvedValue({ data: updatedAssay })

    render(
      <AssayDefinitionsTable
        assays={[assay]}
        page={1}
        pageSize={10}
        totalPages={1}
        totalCount={1}
        specialties={[specialty]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sửa chỉ tiêu' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Mã chỉ tiêu')).toBeDefined()
    expect(within(dialog).getByText('CT-000123')).toBeDefined()
    expect(within(dialog).queryByLabelText('Mã chỉ tiêu')).toBeNull()
    fireEvent.change(screen.getByLabelText(/Tên chỉ tiêu/i), {
      target: { value: updatedAssay.name },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() => {
      expect(screen.getByText(updatedAssay.name)).toBeDefined()
      expect(screen.getByText('CT-000123')).toBeDefined()
    })
    expect(mocks.updateAssayDefinitionClient.mock.calls[0][0]).not.toHaveProperty('import_code')
  })
})
