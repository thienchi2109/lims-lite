import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

import { CoAPreviewDialog } from '../coa-preview-dialog'

describe('CoAPreviewDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches CoA html when opened and renders it in the shared dialog', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body><main>CoA ready</main></body></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      }) as Response,
    )

    render(
      <CoAPreviewDialog
        open
        onOpenChange={vi.fn()}
        sampleId="sample-1"
        title="Phiếu kết quả"
        route="staff"
      />,
    )

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/coa/view?sample_id=sample-1',
      expect.objectContaining({ cache: 'no-store', credentials: 'include' }),
    )
    await waitFor(() =>
      expect(screen.getByTitle('Phiếu kết quả').getAttribute('srcdoc')).toContain('CoA ready'),
    )
  })

  it('invokes the unauthorized callback when the server rejects access', async () => {
    const onUnauthorized = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        { error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại' },
        { status: 401 },
      ) as Response,
    )

    render(
      <CoAPreviewDialog
        open
        onOpenChange={vi.fn()}
        sampleId="sample-1"
        title="Phiếu kết quả"
        route="client"
        onUnauthorized={onUnauthorized}
      />,
    )

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại')).toBeDefined()
  })

  it('does not invoke unauthorized recovery for a permission denial', async () => {
    const onUnauthorized = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        { error: 'Bạn không có quyền truy cập tài liệu này.' },
        { status: 403 },
      ) as Response,
    )

    render(
      <CoAPreviewDialog
        open
        onOpenChange={vi.fn()}
        sampleId="sample-1"
        title="Phiếu kết quả"
        route="staff"
        onUnauthorized={onUnauthorized}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Bạn không có quyền truy cập tài liệu này.')).toBeDefined(),
    )
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('shows a localized failure message and allows retry', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({ error: 'Không tìm thấy phiếu kết quả' }, { status: 404 }) as Response,
      )
      .mockResolvedValueOnce(
        new Response('<html><body><main>CoA retry</main></body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        }) as Response,
      )

    render(
      <CoAPreviewDialog
        open
        onOpenChange={vi.fn()}
        sampleId="sample-1"
        title="Phiếu kết quả"
        route="staff"
      />,
    )

    await waitFor(() => expect(screen.getByText('Không tìm thấy phiếu kết quả')).toBeDefined())
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await screen.findByRole('button', { name: 'Thử lại' })
    await act(async () => {
      screen.getByRole('button', { name: 'Thử lại' }).click()
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getByTitle('Phiếu kết quả').getAttribute('srcdoc')).toContain('CoA retry'),
    )
  })

  it('falls back to a localized status message for non-json failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body>Access denied</body></html>', {
        status: 500,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      }) as Response,
    )

    render(
      <CoAPreviewDialog
        open
        onOpenChange={vi.fn()}
        sampleId="sample-1"
        title="Phiếu kết quả"
        route="client"
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Không thể tải tài liệu xem trước. Vui lòng thử lại.')).toBeDefined(),
    )
    expect(screen.queryByText('Access denied')).toBeNull()
  })
})
