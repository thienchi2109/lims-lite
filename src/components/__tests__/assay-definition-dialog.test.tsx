import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssayDefinitionDialog } from '../assay-definition-dialog'
import type { AssayDefinition } from '../assay-definition-dialog/types'
import type { LabSpecialty } from '@/types'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  createAssayDefinitionClient: vi.fn(),
  updateAssayDefinitionClient: vi.fn(),
  fetchMethodsClient: vi.fn(),
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
  fetchMethodsClient: (...args: unknown[]) => mocks.fetchMethodsClient(...args),
}))

vi.mock('@/app/actions/lab-specialties', () => ({
  createLabSpecialty: (...args: unknown[]) => mocks.createLabSpecialty(...args),
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
  name: 'HIV Ag/Ab',
  specialty_id: specialty.id,
  units: 'Index',
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
    mocks.fetchMethodsClient.mockResolvedValue({ data: [] })
  })

  it('renders assay details read-only without submit controls', () => {
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
    expect(screen.getAllByText('Có').length).toBeGreaterThan(0)
    expect(screen.getByText('Số (Numeric)')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Tạo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cập nhật' })).toBeNull()
  })
})
