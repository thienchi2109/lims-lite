import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssayDefinitionDialog } from '../assay-definition-dialog'
import type { AssayDefinition } from '../assay-definition-dialog/types'
import type { LabSpecialty } from '@/types'

const mocks = vi.hoisted(() => ({
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
  useRouter: () => ({ refresh: mocks.refresh }),
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
        {specialties.map((specialty) => (
          <option key={specialty.id} value={specialty.id}>
            {specialty.name}
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

Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.setPointerCapture = vi.fn()
Element.prototype.releasePointerCapture = vi.fn()

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
  name: 'HIV Ag/Ab',
  specialty_id: specialty.id,
  method_name: 'ELISA',
  units: 'Index',
  normal_range: 'Âm tính',
  is_confidential: true,
  validation_rules: {
    min: 0,
    max: 1,
    type: 'numeric',
    required: true,
  },
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

describe('AssayDefinitionDialog detail mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchMethodNameSuggestionsClient.mockResolvedValue({ data: ['ELISA', 'CLIA'] })
  })

  it('renders assay details read-only with assay-owned method text and without submit controls', () => {
    render(
      <AssayDefinitionDialog
        open
        onOpenChange={vi.fn()}
        mode="view"
        assay={assay}
        specialties={[specialty]}
      />,
    )

    expect(screen.getByText('Chi tiết chỉ tiêu xét nghiệm')).toBeDefined()
    expect(screen.getByText('HIV Ag/Ab')).toBeDefined()
    expect(screen.getByText('Miễn dịch')).toBeDefined()
    expect(screen.getByText('ELISA')).toBeDefined()
    expect(screen.getByText('Index')).toBeDefined()
    expect(screen.getByText('Khoảng tham chiếu')).toBeDefined()
    expect(screen.getByText('Âm tính')).toBeDefined()
    expect(screen.getAllByText('Có').length).toBeGreaterThan(0)
    expect(screen.getByText('Số (Numeric)')).toBeDefined()
    expect(screen.queryByLabelText(/Phương pháp/i)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tạo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cập nhật' })).toBeNull()
  })
})

describe('AssayDefinitionDialog method entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAssayDefinitionClient.mockResolvedValue({ data: { id: 'assay-new' } })
    mocks.updateAssayDefinitionClient.mockResolvedValue({ data: { id: 'assay-1' } })
    mocks.fetchMethodNameSuggestionsClient.mockResolvedValue({ data: ['ELISA', 'CLIA'] })
  })

  it('creates an assay with arbitrary Phương pháp text as methodName', async () => {
    render(
      <AssayDefinitionDialog
        open
        onOpenChange={vi.fn()}
        mode="create"
        specialties={[specialty]}
      />,
    )

    expect(await screen.findByText('ELISA')).toBeDefined()
    expect(screen.getByText('CLIA')).toBeDefined()
    expect(screen.queryByText('Phương pháp ban đầu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dùng gợi ý phương pháp CLIA' }))
    expect((screen.getByRole('textbox', { name: /Phương pháp/i }) as HTMLInputElement).value).toBe('CLIA')

    fireEvent.change(screen.getByLabelText(/Tên chỉ tiêu/i), {
      target: { value: 'HIV RNA' },
    })
    fireEvent.change(screen.getByLabelText(/Nhóm kỹ thuật/i), {
      target: { value: specialty.id },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Phương pháp/i }), {
      target: { value: 'RT-PCR tự thiết lập' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))

    await waitFor(() => {
      expect(mocks.createAssayDefinitionClient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'HIV RNA',
          specialty_id: specialty.id,
          methodName: 'RT-PCR tự thiết lập',
        }),
      )
    })
    expect(mocks.createAssayDefinitionClient.mock.calls[0][0]).not.toHaveProperty('methodId')
  })

  it('updates assay-owned Phương pháp text without showing catalog method management', async () => {
    render(
      <AssayDefinitionDialog
        open
        onOpenChange={vi.fn()}
        mode="edit"
        assay={{ ...assay, method_name: 'Western blot' }}
        specialties={[specialty]}
      />,
    )

    expect(screen.queryByText('Danh sách phương pháp')).toBeNull()

    const methodInput = screen.getByRole('textbox', { name: /Phương pháp/i })
    expect((methodInput as HTMLInputElement).value).toBe('Western blot')
    fireEvent.change(methodInput, {
      target: { value: 'ELISA cải tiến' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() => {
      expect(mocks.updateAssayDefinitionClient).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'assay-1',
          methodName: 'ELISA cải tiến',
        }),
      )
    })
  })

  it('shows the approved reference range placeholder and submits multiline text', async () => {
    render(
      <AssayDefinitionDialog
        open
        onOpenChange={vi.fn()}
        mode="create"
        specialties={[specialty]}
      />,
    )

    const referenceRangeInput = screen.getByRole('textbox', { name: /Khoảng tham chiếu/i })
    expect(referenceRangeInput.getAttribute('placeholder')).toContain('Nam: 208 - 428 µmol/L')
    expect(referenceRangeInput.getAttribute('placeholder')).toContain('Âm tính')

    fireEvent.change(screen.getByLabelText(/Tên chỉ tiêu/i), {
      target: { value: 'Creatinine' },
    })
    fireEvent.change(screen.getByLabelText(/Nhóm kỹ thuật/i), {
      target: { value: specialty.id },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Phương pháp/i }), {
      target: { value: 'Jaffe' },
    })
    fireEvent.change(referenceRangeInput, {
      target: { value: 'Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))

    await waitFor(() => {
      expect(mocks.createAssayDefinitionClient).toHaveBeenCalledWith(
        expect.objectContaining({
          normalRange: 'Nam: 208 - 428 µmol/L\nNữ: 155 - 357 µmol/L',
        }),
      )
    })
  })

  it('initializes reference range for edits and submits blank text to clear it', async () => {
    render(
      <AssayDefinitionDialog
        open
        onOpenChange={vi.fn()}
        mode="edit"
        assay={{ ...assay, normal_range: 'Âm tính' }}
        specialties={[specialty]}
      />,
    )

    const referenceRangeInput = screen.getByRole('textbox', { name: /Khoảng tham chiếu/i })
    expect((referenceRangeInput as HTMLTextAreaElement).value).toBe('Âm tính')

    fireEvent.change(referenceRangeInput, {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() => {
      expect(mocks.updateAssayDefinitionClient).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'assay-1',
          normalRange: '',
        }),
      )
    })
  })

  it('debounces method suggestion filtering while the manager types', async () => {
    render(
      <AssayDefinitionDialog
        open
        onOpenChange={vi.fn()}
        mode="create"
        specialties={[specialty]}
      />,
    )

    expect(await screen.findByText('ELISA')).toBeDefined()
    expect(screen.getByText('CLIA')).toBeDefined()

    fireEvent.change(screen.getByRole('textbox', { name: /Phương pháp/i }), {
      target: { value: 'cli' },
    })

    expect(screen.getByText('ELISA')).toBeDefined()

    await waitFor(
      () => {
        expect(screen.queryByText('ELISA')).toBeNull()
        expect(screen.getByText('CLIA')).toBeDefined()
      },
      { timeout: 1000 },
    )
  })
})
