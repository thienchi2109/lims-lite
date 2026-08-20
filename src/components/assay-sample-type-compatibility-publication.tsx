'use client'

import { useState } from 'react'
import { CopyPlus, FileCheck2, RefreshCw, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CatalogDiffDetail } from '@/components/assay-sample-type-compatibility-utils'
import type { AssaySampleTypeCatalogManager } from '@/types'

type CatalogRevision = NonNullable<
  AssaySampleTypeCatalogManager['revision']
>

export function AssaySampleTypeCompatibilityPublication({
  revision,
  diffDetails,
  isBusy,
  onReview,
  onPublish,
}: {
  revision: CatalogRevision
  diffDetails: CatalogDiffDetail[]
  isBusy: boolean
  onReview: () => Promise<void>
  onPublish: (reason: string) => Promise<void>
}) {
  const [publishReason, setPublishReason] = useState('')
  const [diffAcknowledged, setDiffAcknowledged] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handlePublish() {
    if (!diffAcknowledged) {
      setValidationError('Vui lòng kiểm tra chi tiết thay đổi trước khi xuất bản')
      return
    }
    const reason = publishReason.trim()
    if (!reason) {
      setValidationError('Vui lòng nhập lý do xuất bản')
      return
    }
    setValidationError(null)
    await onPublish(reason)
  }

  return (
    <section className="border-y bg-white px-4 py-5 dark:bg-slate-950">
      <div className="mb-5 space-y-3">
        <h2 className="font-semibold">Chi tiết thay đổi</h2>
        {diffDetails.length > 0 ? (
          <div className="divide-y border-y">
            {diffDetails.map((detail) => (
              <div
                key={detail.id}
                className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(140px,0.8fr)_1fr_1fr]"
              >
                <span className="font-medium">
                  Chỉ tiêu: {detail.assayName}
                </span>
                <span>
                  <span className="block text-xs text-slate-500">Trước</span>
                  {detail.before}
                </span>
                <span>
                  <span className="block text-xs text-slate-500">Sau</span>
                  {detail.after}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Không có thay đổi chi tiết.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={diffAcknowledged}
            onCheckedChange={(checked) => setDiffAcknowledged(checked === true)}
            disabled={isBusy}
          />
          Tôi đã kiểm tra chi tiết thay đổi
        </label>
      </div>
      <div className="grid gap-5 lg:grid-cols-[auto_minmax(280px,1fr)_auto] lg:items-end">
        <div>
          <p className="font-semibold">Xác nhận bản nháp</p>
          <p className="text-sm text-slate-500">
            {revision.contentHash
              ? `Mã nội dung: ${revision.contentHash}`
              : 'Bản nháp chưa được xác nhận.'}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={onReview}
            disabled={isBusy || !diffAcknowledged}
          >
            {isBusy ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <FileCheck2 className="size-4" />
            )}
            Xác nhận bản nháp
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="publish-reason">Lý do xuất bản</Label>
          <Textarea
            id="publish-reason"
            value={publishReason}
            onChange={(event) => setPublishReason(event.target.value)}
            disabled={isBusy || !revision.contentHash}
          />
          {validationError ? (
            <p role="alert" className="text-sm text-red-600">
              {validationError}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={handlePublish}
          disabled={isBusy || !revision.contentHash || !diffAcknowledged}
        >
          <Send className="size-4" />
          Xuất bản phiên bản {revision.revisionNumber}
        </Button>
      </div>
    </section>
  )
}

export function AssaySampleTypeCompatibilityClone({
  revisionNumber,
  isBusy,
  onClone,
}: {
  revisionNumber: number
  isBusy: boolean
  onClone: (reason: string) => Promise<void>
}) {
  const [creationReason, setCreationReason] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleClone() {
    const reason = creationReason.trim()
    if (!reason) {
      setValidationError('Vui lòng nhập lý do tạo bản nháp')
      return
    }
    setValidationError(null)
    await onClone(reason)
  }

  return (
    <section className="border-y bg-white px-4 py-5 dark:bg-slate-950">
      <div className="grid gap-4 sm:grid-cols-[minmax(280px,1fr)_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="clone-reason">Lý do tạo bản nháp</Label>
          <Textarea
            id="clone-reason"
            value={creationReason}
            onChange={(event) => setCreationReason(event.target.value)}
            disabled={isBusy}
          />
          {validationError ? (
            <p role="alert" className="text-sm text-red-600">
              {validationError}
            </p>
          ) : null}
        </div>
        <Button type="button" onClick={handleClone} disabled={isBusy}>
          <CopyPlus className="size-4" />
          Tạo bản nháp từ phiên bản {revisionNumber}
        </Button>
      </div>
    </section>
  )
}
