import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CoAAccessSampleCard } from '../coa-access-sample-card'
import type { CoASampleInfo } from '@/types'

const readySample: CoASampleInfo = {
  id: '11111111-1111-1111-1111-111111111111',
  sample_id_display: 'BN-99210',
  sample_type: 'Máu',
  received_date: '2026-03-21T08:00:00.000Z',
  approved_at: '2026-03-21T09:00:00.000Z',
  has_coa: true,
}

describe('CoAAccessSampleCard', () => {
  it('uses one full-width mobile preview action', () => {
    const onPreview = vi.fn()

    render(<CoAAccessSampleCard sample={readySample} onPreview={onPreview} />)

    const previewButton = screen.getByRole('button', { name: 'Xem phiếu kết quả' })
    expect(screen.getAllByRole('button', { name: 'Xem phiếu kết quả' })).toHaveLength(1)
    expect(previewButton.className).toContain('w-full')

    fireEvent.click(previewButton)
    expect(onPreview).toHaveBeenCalledWith(readySample.id, readySample.sample_id_display)
  })

  it('shows a static pending status while keeping essential sample details visible', () => {
    render(
      <CoAAccessSampleCard
        sample={{ ...readySample, has_coa: false, approved_at: null }}
        onPreview={vi.fn()}
      />,
    )

    expect(screen.getByText('BN-99210')).toBeDefined()
    expect(screen.getByText('Máu')).toBeDefined()
    expect(screen.getByText('Đang xử lý')).toBeDefined()
    expect(screen.getByTestId('coa-pending-icon').className).not.toContain('animate-spin')
    expect(screen.queryByRole('button', { name: 'Xem phiếu kết quả' })).toBeNull()
  })
})
