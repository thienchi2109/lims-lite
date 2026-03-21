import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { DocumentPreviewDialog } from '../document-preview-dialog'

describe('DocumentPreviewDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 960,
    })
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
    expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin allow-modals')
    const focusSpy = vi.fn()
    const printSpy = vi.fn()
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: {
        focus: focusSpy,
        print: printSpy,
      },
    })

    expect(iframe.getAttribute('srcdoc')).toContain('CoA')

    fireEvent.click(screen.getByRole('button', { name: 'In tài liệu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mở trong tab mới' }))

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(printSpy).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith(
      '/api/coa/view?sample_id=sample-1',
      '_blank',
      'noopener,noreferrer',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('fits the entire CoA page inside the desktop preview shell', () => {
    render(
      <DocumentPreviewDialog
        open
        onOpenChange={vi.fn()}
        title="Phiếu kết quả"
        loading={false}
        error={null}
        html="<html><body><h1>CoA</h1></body></html>"
        documentUrl="/api/coa/view?sample_id=sample-1"
        onRetry={vi.fn()}
      />,
    )

    const frame = screen.getByTestId('document-preview-frame')
    const iframe = screen.getByTitle('Phiếu kết quả')
    const viewport = frame.parentElement

    expect(screen.getByTestId('document-preview-dialog').className).toContain('max-w-[1480px]')
    expect(screen.getByTestId('document-preview-dialog').className).toContain('sm:max-w-[1480px]')
    expect(screen.getByTestId('document-preview-shell').className).toContain('h-[min(90vh,1040px)]')
    expect(viewport?.className).not.toContain('md:items-center')
    expect(parseFloat(frame.style.width)).toBeLessThan(920)
    expect(parseFloat(frame.style.height)).toBeLessThan(1260)
    expect(iframe.style.transform).not.toBe('scale(1)')
  })

  it('scales the preview down to fit narrow mobile screens without changing print actions', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    })

    render(
      <DocumentPreviewDialog
        open
        onOpenChange={vi.fn()}
        title="Phiếu kết quả"
        loading={false}
        error={null}
        html="<html><body><h1>CoA</h1></body></html>"
        documentUrl="/api/coa/view?sample_id=sample-1"
        onRetry={vi.fn()}
      />,
    )

    const frame = screen.getByTestId('document-preview-frame')
    const iframe = screen.getByTitle('Phiếu kết quả')

    expect(parseFloat(frame.style.width)).toBeLessThan(390)
    expect(iframe.style.transform).not.toBe('scale(1)')
  })

  it('keeps the mobile close button inside the tappable header area', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    })

    render(
      <DocumentPreviewDialog
        open
        onOpenChange={vi.fn()}
        title="Phiếu kết quả"
        loading={false}
        error={null}
        html="<html><body><h1>CoA</h1></body></html>"
        documentUrl="/api/coa/view?sample_id=sample-1"
        onRetry={vi.fn()}
      />,
    )

    const closeButton = screen.getByRole('button', { name: 'Đóng' })
    const header = closeButton.parentElement

    expect(header?.className).toContain('relative')
    expect(header?.className).toContain('z-10')
    expect(closeButton.className).toContain('touch-manipulation')
    expect(closeButton.className).toContain('mr-1')
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
