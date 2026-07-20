import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CoAPreviewDialog } from '../coa-preview-dialog'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

const READY_HTML = '<html><body><main>CoA ready</main></body></html>'
const PDF_BYTES = new Uint8Array([37, 80, 68, 70])
const ATTACHMENT_NAME = 'PhieuKetQuaXN-BN-99210-20260720.pdf'

function createHtmlResponse(): Response {
  return new Response(READY_HTML, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function createPdfResponse(): Response {
  return new Response(PDF_BYTES, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${ATTACHMENT_NAME}"`,
    },
  })
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
}

function renderDialog({
  route,
  pdfEndpoint,
  onUnauthorized,
}: {
  route: 'staff' | 'client'
  pdfEndpoint: '/api/coa/view/pdf' | '/api/coa/download/pdf'
  onUnauthorized?: () => void
}) {
  return render(
    <CoAPreviewDialog
      open
      onOpenChange={vi.fn()}
      sampleId="sample 1"
      title="Phiếu kết quả"
      route={route}
      pdfEndpoint={pdfEndpoint}
      onUnauthorized={onUnauthorized}
    />,
  )
}

describe('CoAPreviewDialog PDF download', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setViewportWidth(1280)
  })

  it.each([
    {
      audience: 'staff',
      route: 'staff' as const,
      pdfEndpoint: '/api/coa/view/pdf' as const,
      viewport: 'desktop',
      width: 1280,
    },
    {
      audience: 'staff',
      route: 'staff' as const,
      pdfEndpoint: '/api/coa/view/pdf' as const,
      viewport: 'mobile',
      width: 390,
    },
    {
      audience: 'client',
      route: 'client' as const,
      pdfEndpoint: '/api/coa/download/pdf' as const,
      viewport: 'desktop',
      width: 1280,
    },
    {
      audience: 'client',
      route: 'client' as const,
      pdfEndpoint: '/api/coa/download/pdf' as const,
      viewport: 'mobile',
      width: 390,
    },
  ])(
    'downloads the $audience attachment from the $viewport preview',
    async ({ route, pdfEndpoint, width }) => {
      setViewportWidth(width)
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(createHtmlResponse())
        .mockResolvedValueOnce(createPdfResponse())
      const createObjectUrlSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:coa-pdf')
      const revokeObjectUrlSpy = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => undefined)
      let downloadedFilename = ''
      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          downloadedFilename = this.download
        })

      renderDialog({ route, pdfEndpoint })

      const downloadButton = await screen.findByRole('button', { name: 'Tải PDF' })
      fireEvent.click(downloadButton)

      await waitFor(() => expect(anchorClickSpy).toHaveBeenCalledTimes(1))
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        `${pdfEndpoint}?sample_id=sample%201`,
        expect.objectContaining({
          cache: 'no-store',
          credentials: 'include',
        }),
      )
      expect(downloadedFilename).toBe(ATTACHMENT_NAME)
      const downloadedBlob = createObjectUrlSpy.mock.calls[0]?.[0]
      expect(downloadedBlob?.type).toBe('application/pdf')
      expect(downloadedBlob?.size).toBe(PDF_BYTES.byteLength)
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:coa-pdf')
    },
  )

  it('disables duplicate clicks while one PDF request is pending', async () => {
    const deferredPdf = createDeferred<Response>()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createHtmlResponse())
      .mockImplementationOnce(() => deferredPdf.promise)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:coa-pdf')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    renderDialog({
      route: 'staff',
      pdfEndpoint: '/api/coa/view/pdf',
    })

    const downloadButton = await screen.findByRole('button', { name: 'Tải PDF' })
    fireEvent.click(downloadButton)
    fireEvent.click(downloadButton)

    expect(
      (screen.getByRole('button', { name: 'Đang tải PDF...' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    await act(async () => {
      deferredPdf.resolve(createPdfResponse())
      await deferredPdf.promise
    })

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Tải PDF' }) as HTMLButtonElement).disabled).toBe(
        false,
      )
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('keeps the preview visible and shows a Vietnamese error without printing', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createHtmlResponse())
      .mockResolvedValueOnce(
        Response.json(
          { error: 'Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.' },
          { status: 503 },
        ) as Response,
      )
    renderDialog({
      route: 'staff',
      pdfEndpoint: '/api/coa/view/pdf',
    })

    const previewFrame = await screen.findByTitle('Phiếu kết quả')
    const printSpy = vi
      .spyOn(previewFrame.contentWindow as Window, 'print')
      .mockImplementation(() => undefined)
    fireEvent.click(await screen.findByRole('button', { name: 'Tải PDF' }))

    await waitFor(() =>
      expect(
        screen.getByText('Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.'),
      ).toBeDefined(),
    )
    expect(screen.getByTitle('Phiếu kết quả').getAttribute('srcdoc')).toContain('CoA ready')
    expect(printSpy).not.toHaveBeenCalled()
  })

  it('does not recover an aborted client download after failure parsing completes', async () => {
    const deferredFailureBody = createDeferred<{ error: string }>()
    const failureResponse = Response.json(
      { error: 'Token đã hết hạn. Vui lòng đăng nhập lại' },
      { status: 401 },
    )
    vi.spyOn(failureResponse, 'json').mockImplementation(() => deferredFailureBody.promise)
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createHtmlResponse())
      .mockResolvedValueOnce(failureResponse)
    const onUnauthorized = vi.fn()
    const dialog = renderDialog({
      route: 'client',
      pdfEndpoint: '/api/coa/download/pdf',
      onUnauthorized,
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Tải PDF' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))

    dialog.rerender(
      <CoAPreviewDialog
        open={false}
        onOpenChange={vi.fn()}
        sampleId="sample 1"
        title="Phiếu kết quả"
        route="client"
        pdfEndpoint="/api/coa/download/pdf"
        onUnauthorized={onUnauthorized}
      />,
    )

    await act(async () => {
      deferredFailureBody.resolve({
        error: 'Token đã hết hạn. Vui lòng đăng nhập lại',
      })
      await deferredFailureBody.promise
    })

    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('returns an expired client session to re-auth without retrying the PDF request', async () => {
    const onUnauthorized = vi.fn()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createHtmlResponse())
      .mockResolvedValueOnce(
        Response.json(
          { error: 'Token đã hết hạn. Vui lòng đăng nhập lại' },
          { status: 401 },
        ) as Response,
      )

    renderDialog({
      route: 'client',
      pdfEndpoint: '/api/coa/download/pdf',
      onUnauthorized,
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Tải PDF' }))

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(
      fetchSpy.mock.calls.filter(([input]) =>
        String(input).startsWith('/api/coa/download/pdf'),
      ),
    ).toHaveLength(1)
  })
})
