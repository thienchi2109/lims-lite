import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  createAssayDefinitionClient: vi.fn(),
  updateAssayDefinitionClient: vi.fn(),
  fetchMethodsClient: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}))

vi.mock('sonner', () => ({
  toast: mocks.toast,
}))

vi.mock('@/lib/api-client', () => ({
  createAssayDefinitionClient: (...args: unknown[]) => mocks.createAssayDefinitionClient(...args),
  updateAssayDefinitionClient: (...args: unknown[]) => mocks.updateAssayDefinitionClient(...args),
  fetchMethodsClient: (...args: unknown[]) => mocks.fetchMethodsClient(...args),
}))

import { useAssayDefinitionForm } from '../hooks/use-assay-definition-form'

describe('useAssayDefinitionForm confidentiality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchMethodsClient.mockResolvedValue({ data: [] })
    mocks.createAssayDefinitionClient.mockResolvedValue({ data: { id: 'assay-1' } })
    mocks.updateAssayDefinitionClient.mockResolvedValue({ data: { id: 'assay-1' } })
  })

  it('starts with a false confidential flag for new assays', () => {
    const { result } = renderHook(() =>
      useAssayDefinitionForm({
        mode: 'create',
        onClose: vi.fn(),
      }),
    )

    expect(result.current.form.getValues('isConfidential')).toBe(false)
  })

  it('hydrates the confidential flag when editing an assay', () => {
    const { result } = renderHook(() =>
      useAssayDefinitionForm({
        mode: 'edit',
        assay: {
          id: 'assay-1',
          name: 'HIV Ag/Ab',
          specialty_id: null,
          units: 'Index',
          validation_rules: {},
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
          deleted_at: null,
          is_confidential: true,
        },
        onClose: vi.fn(),
      }),
    )

    act(() => {
      result.current.initializeForm({
        id: 'assay-1',
        name: 'HIV Ag/Ab',
        specialty_id: null,
        units: 'Index',
        validation_rules: {},
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-03-25T00:00:00.000Z',
        deleted_at: null,
        is_confidential: true,
      })
    })

    expect(result.current.form.getValues('isConfidential')).toBe(true)
  })

  it('submits the confidential flag when creating an assay', async () => {
    const onClose = vi.fn()
    const { result } = renderHook(() =>
      useAssayDefinitionForm({
        mode: 'create',
        onClose,
      }),
    )

    act(() => {
      result.current.form.setValue('name', 'HIV Ag/Ab')
      result.current.form.setValue('isConfidential', true)
      result.current.form.setValue('specialtyId', 'specialty-1')
    })

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never)
    })

    await waitFor(() => {
      expect(mocks.createAssayDefinitionClient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'HIV Ag/Ab',
          specialty_id: 'specialty-1',
          is_confidential: true,
        }),
      )
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('submits the confidential flag when updating an assay', async () => {
    const onClose = vi.fn()
    const { result } = renderHook(() =>
      useAssayDefinitionForm({
        mode: 'edit',
        assay: {
          id: 'assay-1',
          name: 'HIV Ag/Ab',
          specialty_id: null,
          units: 'Index',
          validation_rules: {},
          created_at: '2026-03-25T00:00:00.000Z',
          updated_at: '2026-03-25T00:00:00.000Z',
          deleted_at: null,
          is_confidential: false,
        },
        onClose,
      }),
    )

    act(() => {
      result.current.form.setValue('name', 'HIV Ag/Ab updated')
      result.current.form.setValue('isConfidential', true)
      result.current.form.setValue('specialtyId', 'specialty-1')
    })

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never)
    })

    await waitFor(() => {
      expect(mocks.updateAssayDefinitionClient).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'assay-1',
          name: 'HIV Ag/Ab updated',
          is_confidential: true,
        }),
      )
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
