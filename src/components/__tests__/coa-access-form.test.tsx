import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { CoAAccessForm } from '../coa-access-form'

describe('CoAAccessForm public preview flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function createAuthenticatedSamplesResponse(): Response {
    return Response.json(
      {
        success: true,
        client_id: 'client-1',
        client_name: 'Nguyen Van A',
        samples: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            sample_id_display: 'BN-99210',
            sample_type: 'Máu',
            received_date: '2026-03-21T08:00:00.000Z',
            approved_at: '2026-03-21T09:00:00.000Z',
            has_coa: true,
          },
        ],
      },
      { status: 200 },
    ) as Response
  }

  function mockAuthenticatedSamples() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/coa/authenticate') {
        return createAuthenticatedSamplesResponse()
      }

      if (url.startsWith('/api/coa/download/pdf')) {
        return new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-disposition':
              'attachment; filename="PhieuKetQuaXN-BN-99210-20260720.pdf"',
          },
        }) as Response
      }

      if (url.startsWith('/api/coa/download?')) {
        return new Response('<html><body><main>CoA preview body</main></body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        }) as Response
      }

      if (url === '/api/coa/logout') {
        return new Response(null, { status: 200 }) as Response
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? 'GET'}`)
    })
  }

  it('opens the embedded preview without leaving the authenticated sample list', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    mockAuthenticatedSamples()

    render(<CoAAccessForm />)

    fireEvent.change(screen.getByLabelText('Số điện thoại đăng ký *'), {
      target: { value: '0987654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tra Cứu Ngay' }))

    await waitFor(() => expect(screen.getByText('Nguyen Van A')).toBeDefined())

    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu kết quả' }))

    await waitFor(() =>
      expect(screen.getByTitle('Phiếu Kết Quả Phân Tích').getAttribute('srcdoc')).toContain(
        'CoA preview body',
      ),
    )
    expect(screen.getByText('BN-99210')).toBeDefined()
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('downloads the client PDF through the scoped client endpoint', async () => {
    const fetchSpy = mockAuthenticatedSamples()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:client-coa')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    render(<CoAAccessForm />)

    fireEvent.change(screen.getByLabelText('Số điện thoại đăng ký *'), {
      target: { value: '0987654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tra Cứu Ngay' }))

    await waitFor(() => expect(screen.getByText('Nguyen Van A')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu kết quả' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Tải PDF' }))

    await waitFor(() => expect(anchorClickSpy).toHaveBeenCalledTimes(1))
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/coa/download/pdf?sample_id=11111111-1111-1111-1111-111111111111',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
      }),
    )
  })

  it('shows the preview route failure inside the dialog', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)

      if (url === '/api/coa/authenticate') {
        return createAuthenticatedSamplesResponse()
      }

      if (url.startsWith('/api/coa/download')) {
        return Response.json({ error: 'Không tìm thấy phiếu kết quả' }, { status: 404 }) as Response
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(<CoAAccessForm />)

    fireEvent.change(screen.getByLabelText('Số điện thoại đăng ký *'), {
      target: { value: '0987654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tra Cứu Ngay' }))

    await waitFor(() => expect(screen.getByText('Nguyen Van A')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu kết quả' }))

    await waitFor(() => expect(screen.getByText('Không tìm thấy phiếu kết quả')).toBeDefined())
    expect(screen.getByText('BN-99210')).toBeDefined()
  })

  it('returns to the login form when the preview reports an expired session', async () => {
    const logoutSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/coa/authenticate') {
        return createAuthenticatedSamplesResponse()
      }

      if (url.startsWith('/api/coa/download')) {
        return Response.json(
          { error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại' },
          { status: 401 },
        ) as Response
      }

      if (url === '/api/coa/logout') {
        return logoutSpy()
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? 'GET'}`)
    })

    render(<CoAAccessForm />)

    fireEvent.change(screen.getByLabelText('Số điện thoại đăng ký *'), {
      target: { value: '0987654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tra Cứu Ngay' }))

    await waitFor(() => expect(screen.getByText('Nguyen Van A')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu kết quả' }))

    await waitFor(() =>
      expect(screen.getByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại')).toBeDefined(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập lại' }))

    await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tra Cứu Ngay' })).toBeDefined())
    expect(screen.queryByText('Nguyen Van A')).toBeNull()
  })

  it('returns to login once when the PDF token expires without retrying download', async () => {
    const logoutSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/coa/authenticate') {
        return createAuthenticatedSamplesResponse()
      }

      if (url.startsWith('/api/coa/download/pdf')) {
        return Response.json(
          { error: 'Token đã hết hạn. Vui lòng đăng nhập lại' },
          { status: 401 },
        ) as Response
      }

      if (url.startsWith('/api/coa/download?')) {
        return new Response('<html><body><main>CoA preview body</main></body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        }) as Response
      }

      if (url === '/api/coa/logout') {
        return logoutSpy()
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? 'GET'}`)
    })

    render(<CoAAccessForm />)

    fireEvent.change(screen.getByLabelText('Số điện thoại đăng ký *'), {
      target: { value: '0987654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tra Cứu Ngay' }))

    await waitFor(() => expect(screen.getByText('Nguyen Van A')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu kết quả' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Tải PDF' }))

    await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tra Cứu Ngay' })).toBeDefined())
    expect(screen.queryByText('Nguyen Van A')).toBeNull()
    expect(
      fetchSpy.mock.calls.filter(([input]) =>
        String(input).startsWith('/api/coa/download/pdf'),
      ),
    ).toHaveLength(1)
  })

  it('notifies the portal shell when authentication state changes', async () => {
    const onAuthenticatedChange = vi.fn()
    mockAuthenticatedSamples()

    render(<CoAAccessForm onAuthenticatedChange={onAuthenticatedChange} />)

    fireEvent.change(screen.getByLabelText('Số điện thoại đăng ký *'), {
      target: { value: '0987654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tra Cứu Ngay' }))

    await waitFor(() => expect(onAuthenticatedChange).toHaveBeenCalledWith(true))

    fireEvent.click(screen.getByRole('button', { name: 'Thoát' }))

    expect(onAuthenticatedChange).toHaveBeenLastCalledWith(false)
  })

  it('uses document scrolling and a responsive result grid after authentication', async () => {
    mockAuthenticatedSamples()

    render(<CoAAccessForm />)

    fireEvent.change(screen.getByLabelText('Số điện thoại đăng ký *'), {
      target: { value: '0987654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tra Cứu Ngay' }))

    await waitFor(() => expect(screen.getByText('Nguyen Van A')).toBeDefined())

    expect(document.querySelector('[data-radix-scroll-area-viewport]')).toBeNull()
    expect(screen.getByTestId('coa-results-grid').className).toContain('grid-cols-1')
    expect(screen.getByTestId('coa-results-grid').className).toContain('xl:grid-cols-2')
  })
})
