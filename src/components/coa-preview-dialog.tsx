'use client'

import { Download, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { DocumentPreviewDialog } from '@/components/document-preview-dialog'
import { Button } from '@/components/ui/button'

type CoAPreviewRoute = 'staff' | 'client'
type CoAPdfEndpoint = '/api/coa/view/pdf' | '/api/coa/download/pdf'

interface CoAPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sampleId: string
  title: string
  subtitle?: string
  route: CoAPreviewRoute
  pdfEndpoint: CoAPdfEndpoint
  onUnauthorized?: () => void
}

const DEFAULT_PREVIEW_ERROR = 'Không thể tải tài liệu xem trước. Vui lòng thử lại.'
const DEFAULT_DOWNLOAD_ERROR = 'Không thể tải PDF. Vui lòng thử lại.'
const DEFAULT_UNAUTHORIZED_ERROR = 'Phiên truy cập đã hết hạn. Vui lòng đăng nhập lại.'
const DEFAULT_PDF_FILENAME = 'PhieuKetQuaXN.pdf'

function buildCoAUrl(endpoint: string, sampleId: string): string {
  return `${endpoint}?sample_id=${encodeURIComponent(sampleId)}`
}

function getErrorMessageFromStatus(status: number, fallback: string): string {
  if (status === 401) {
    return DEFAULT_UNAUTHORIZED_ERROR
  }

  if (status === 403) {
    return 'Bạn không có quyền truy cập tài liệu này.'
  }

  return fallback
}

async function readFailureMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) {
        return body.error.trim()
      }
    } catch {
      return getErrorMessageFromStatus(response.status, fallback)
    }
  }

  return getErrorMessageFromStatus(response.status, fallback)
}

function readAttachmentFilename(response: Response): string {
  const contentDisposition = response.headers.get('content-disposition') || ''
  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return filenameMatch?.[1] || DEFAULT_PDF_FILENAME
}

function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = filename

  try {
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

export function CoAPreviewDialog({
  open,
  onOpenChange,
  sampleId,
  title,
  subtitle,
  route,
  pdfEndpoint,
  onUnauthorized,
}: CoAPreviewDialogProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [showUnauthorizedAction, setShowUnauthorizedAction] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const onUnauthorizedRef = useRef(onUnauthorized)
  const downloadInFlightRef = useRef(false)
  const downloadControllerRef = useRef<AbortController | null>(null)

  const previewEndpoint = route === 'staff' ? '/api/coa/view' : '/api/coa/download'
  const documentUrl = buildCoAUrl(previewEndpoint, sampleId)
  const pdfUrl = buildCoAUrl(pdfEndpoint, sampleId)
  const hasUnauthorizedRecovery = showUnauthorizedAction && Boolean(onUnauthorized)

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized
  }, [onUnauthorized])

  useEffect(() => {
    if (!open) {
      downloadControllerRef.current?.abort()
      downloadControllerRef.current = null
      downloadInFlightRef.current = false
      setDownloadingPdf(false)
      setDownloadError(null)
    }
  }, [open])

  useEffect(
    () => () => {
      downloadControllerRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (!open) {
      setHtml(null)
      setError(null)
      setLoading(false)
      setShowUnauthorizedAction(false)
      return
    }

    const controller = new AbortController()

    setLoading(true)
    setError(null)
    setHtml(null)
    setShowUnauthorizedAction(false)

    const loadDocument = async () => {
      try {
        const response = await fetch(documentUrl, {
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        })

        if (!response.ok) {
          const failureMessage = await readFailureMessage(response, DEFAULT_PREVIEW_ERROR)
          setShowUnauthorizedAction(response.status === 401)
          setError(failureMessage)
          return
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('text/html')) {
          setShowUnauthorizedAction(false)
          setError(DEFAULT_PREVIEW_ERROR)
          return
        }

        const documentHtml = await response.text()
        if (controller.signal.aborted) {
          return
        }

        setHtml(documentHtml)
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return
        }

        console.error(fetchError)
        setShowUnauthorizedAction(false)
        setError(DEFAULT_PREVIEW_ERROR)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadDocument()

    return () => {
      controller.abort()
    }
  }, [documentUrl, open, retryToken])

  const handlePdfDownload = async () => {
    if (downloadInFlightRef.current) {
      return
    }

    const controller = new AbortController()
    downloadInFlightRef.current = true
    downloadControllerRef.current = controller
    setDownloadingPdf(true)
    setDownloadError(null)

    try {
      const response = await fetch(pdfUrl, {
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
      })

      if (!response.ok) {
        const failureMessage = await readFailureMessage(response, DEFAULT_DOWNLOAD_ERROR)
        if (controller.signal.aborted) {
          return
        }

        setDownloadError(failureMessage)

        if (response.status === 401 && route === 'client') {
          onUnauthorizedRef.current?.()
        }
        return
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/pdf')) {
        setDownloadError(DEFAULT_DOWNLOAD_ERROR)
        return
      }

      const filename = readAttachmentFilename(response)
      const pdfBlob = await response.blob()
      if (controller.signal.aborted) {
        return
      }

      downloadBlob(pdfBlob, filename)
    } catch (downloadFailure) {
      if (controller.signal.aborted) {
        return
      }

      console.error(downloadFailure)
      setDownloadError(DEFAULT_DOWNLOAD_ERROR)
    } finally {
      if (downloadControllerRef.current === controller) {
        downloadControllerRef.current = null
        downloadInFlightRef.current = false
        setDownloadingPdf(false)
      }
    }
  }

  return (
    <DocumentPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      html={html}
      onRetry={() => setRetryToken((value) => value + 1)}
      toolbarAction={
        html && !loading && !error ? (
          <Button
            type="button"
            size="sm"
            onClick={() => void handlePdfDownload()}
            disabled={downloadingPdf}
            className="h-9 gap-2"
          >
            {downloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloadingPdf ? 'Đang tải PDF...' : 'Tải PDF'}
          </Button>
        ) : undefined
      }
      actionError={downloadError}
      errorActionLabel={hasUnauthorizedRecovery ? 'Đăng nhập lại' : undefined}
      onErrorAction={
        hasUnauthorizedRecovery
          ? () => {
              onUnauthorizedRef.current?.()
            }
          : undefined
      }
    />
  )
}
