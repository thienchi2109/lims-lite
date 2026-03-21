import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { DocumentPreviewDialog } from '../document-preview-dialog'

describe('DocumentPreviewDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state with the document title and subtitle', () => {
    render(
      <DocumentPreviewDialog
        open
        onOpenChange={vi.fn()}
        title="Phiếu kết quả"
        subtitle="Mẫu XN-001"
        loading
        error={null}
        html={null}
        documentUrl="/api/coa/view?sample_id=sample-1"
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Phiếu kết quả').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mẫu XN-001').length).toBeGreaterThan(0)
    expect(screen.getByText('Đang tải tài liệu...')).toBeDefined()
    expect(screen.queryByTitle('Phiếu kết quả')).toBeNull()
  })

  it('renders the html document and supports print and open-in-new-tab actions', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const onOpenChange = vi.fn()

    render(
      <DocumentPreviewDialog
        open
        onOpenChange={onOpenChange}
        title="Phiếu kết quả"
        loading={false}
        error={null}
        html="<html><body><h1>CoA</h1></body></html>"
        documentUrl="/api/coa/view?sample_id=sample-1"
        onRetry={vi.fn()}
      />,
    )

    const iframe = screen.getByTitle('Phiếu kết quả')
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: {
        focus: vi.fn(),
        print: vi.fn(),
      },
    })

    expect(iframe.getAttribute('srcdoc')).toContain('CoA')

    fireEvent.click(screen.getByRole('button', { name: 'In tài liệu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mở trong tab mới' }))

    expect(openSpy).toHaveBeenCalledWith(
      '/api/coa/view?sample_id=sample-1',
      '_blank',
      'noopener,noreferrer',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows error state with retry and fallback actions', () => {
    const onRetry = vi.fn()
    render(
      <DocumentPreviewDialog
        open
        onOpenChange={vi.fn()}
        title="Phiếu kết quả"
        loading={false}
        error="Không thể tải phiếu kết quả"
        html={null}
        documentUrl="/api/coa/view?sample_id=sample-1"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('Không thể tải phiếu kết quả')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
