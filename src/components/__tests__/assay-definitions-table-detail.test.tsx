import { fireEvent, render, screen } from '@testing-library/react'
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

    expect(screen.getByText('RT-PCR')).toBeDefined()
  })
})
