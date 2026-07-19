import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CoAAccessPortal } from '../coa-access-portal'

describe('CoAAccessPortal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('presents the lookup workflow and four compact trust features', () => {
    render(<CoAAccessPortal />)

    expect(screen.getByRole('heading', { name: 'Tra cứu kết quả xét nghiệm' })).toBeDefined()

    const featureGrid = screen.getByTestId('coa-feature-grid')
    expect(featureGrid.children).toHaveLength(4)
    expect(featureGrid.className).toContain('grid-cols-1')
    expect(featureGrid.className).toContain('sm:grid-cols-2')
    expect(featureGrid.className).toContain('xl:grid-cols-4')
  })

  it('collapses the introduction and feature strip after authentication', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) !== '/api/coa/authenticate') {
        throw new Error(`Unexpected fetch: ${String(input)}`)
      }

      return Response.json({
        success: true,
        client_id: 'client-1',
        client_name: 'Nguyen Van A',
        samples: [],
      }) as Response
    })

    render(<CoAAccessPortal />)

    fireEvent.change(screen.getByLabelText('Số điện thoại đăng ký *'), {
      target: { value: '0987654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tra Cứu Ngay' }))

    await waitFor(() => expect(screen.getByText('Nguyen Van A')).toBeDefined())

    expect(screen.queryByTestId('coa-feature-grid')).toBeNull()
    expect(screen.queryByText('Tra cứu an toàn, nhận kết quả chính thức')).toBeNull()
    expect(screen.getByTestId('coa-authenticated-workspace')).toBeDefined()
  })
})
