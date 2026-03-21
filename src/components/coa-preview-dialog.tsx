'use client'

import { useEffect, useRef, useState } from 'react'

import { DocumentPreviewDialog } from '@/components/document-preview-dialog'

type CoAPreviewRoute = 'staff' | 'client'

interface CoAPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sampleId: string
  title: string
  subtitle?: string
  route: CoAPreviewRoute
  onUnauthorized?: () => void
}

const DEFAULT_PREVIEW_ERROR = 'Không thể tải tài liệu xem trước. Vui lòng thử lại.'
const DEFAULT_UNAUTHORIZED_ERROR = 'Phiên truy cập đã hết hạn. Vui lòng đăng nhập lại.'

function buildCoAPreviewUrl(route: CoAPreviewRoute, sampleId: string): string {
  const endpoint = route === 'staff' ? '/api/coa/view' : '/api/coa/download'
  return `${endpoint}?sample_id=${encodeURIComponent(sampleId)}`
}

function getErrorMessageFromStatus(status: number): string {
  if (status === 401) {
    return DEFAULT_UNAUTHORIZED_ERROR
  }

  if (status === 403) {
    return 'Bạn không có quyền truy cập tài liệu này.'
  }

  return DEFAULT_PREVIEW_ERROR
}

async function readFailureMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) {
        return body.error.trim()
      }
    } catch {
      return getErrorMessageFromStatus(response.status)
    }
  }

  return getErrorMessageFromStatus(response.status)
}

export function CoAPreviewDialog({
  open,
  onOpenChange,
  sampleId,
  title,
  subtitle,
  route,
  onUnauthorized,
}: CoAPreviewDialogProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [showUnauthorizedAction, setShowUnauthorizedAction] = useState(false)
  const onUnauthorizedRef = useRef(onUnauthorized)

  const documentUrl = buildCoAPreviewUrl(route, sampleId)
  const hasUnauthorizedRecovery = showUnauthorizedAction && Boolean(onUnauthorized)

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized
  }, [onUnauthorized])

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
          const failureMessage = await readFailureMessage(response)
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

  return (
    <DocumentPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      html={html}
      documentUrl={documentUrl}
      onRetry={() => setRetryToken((value) => value + 1)}
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
