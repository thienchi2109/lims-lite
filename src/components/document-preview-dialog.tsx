'use client'

import * as React from 'react'
import { ExternalLink, Loader2, Printer, RefreshCw, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface DocumentPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  loading: boolean
  error: string | null
  html: string | null
  documentUrl: string
  onRetry: () => void
  errorActionLabel?: string
  onErrorAction?: () => void
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  loading,
  error,
  html,
  documentUrl,
  onRetry,
  errorActionLabel,
  onErrorAction,
}: DocumentPreviewDialogProps) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)

  const handlePrint = () => {
    const frameWindow = iframeRef.current?.contentWindow
    if (!frameWindow) {
      return
    }

    frameWindow.focus()
    frameWindow.print()
  }

  const handleOpenInNewTab = () => {
    window.open(documentUrl, '_blank', 'noopener,noreferrer')
  }

  const hasReadyDocument = Boolean(html && !loading && !error)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[1120px] overflow-hidden border-slate-200 bg-white p-0 shadow-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle ?? 'Xem trước tài liệu điện tử'}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-4 text-white">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
              Xem trước tài liệu
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold">{title}</h2>
            {subtitle ? (
              <p className="mt-1 truncate text-sm text-slate-300">{subtitle}</p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-200 hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex h-[min(82vh,840px)] flex-col bg-slate-50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-5 py-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className={cn(
                'inline-flex h-2.5 w-2.5 rounded-full',
                loading ? 'bg-amber-400' : error ? 'bg-rose-500' : 'bg-emerald-500',
              )} />
              {loading ? 'Đang tải tài liệu' : error ? 'Không thể tải tài liệu' : 'Tài liệu sẵn sàng'}
            </div>

            <div className="flex items-center gap-2">
              {hasReadyDocument ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="h-9 gap-2"
                >
                  <Printer className="h-4 w-4" />
                  In tài liệu
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                className="h-9 gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Mở trong tab mới
              </Button>

              {error ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onRetry}
                  className="h-9 gap-2 bg-slate-900 text-white hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  Thử lại
                </Button>
              ) : null}

              {error && errorActionLabel && onErrorAction ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onErrorAction}
                  className="h-9 gap-2"
                >
                  {errorActionLabel}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-hidden bg-white">
            {loading ? (
              <div className="flex h-full items-center justify-center px-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Đang tải tài liệu...</p>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                      Vui lòng chờ trong giây lát, hệ thống đang chuẩn bị tài liệu xem trước.
                    </p>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6">
                <Alert className="max-w-lg border-rose-200 bg-rose-50 text-rose-950">
                  <AlertDescription className="space-y-3 text-sm leading-6">
                    <p className="font-semibold text-rose-950">Không thể tải tài liệu xem trước.</p>
                    <p>{error}</p>
                    <p className="text-rose-900/80">
                      Bạn có thể thử lại hoặc mở tài liệu trong tab mới để tiếp tục.
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            ) : html ? (
              <iframe
                ref={iframeRef}
                title={title}
                srcDoc={html}
                className="h-full w-full border-0 bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6">
                <p className="text-sm text-slate-500">Không có nội dung để hiển thị.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
