'use client'

import { CheckCircle2, Clock3, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { CoASampleInfo } from '@/types'

interface CoAAccessSampleCardProps {
  sample: CoASampleInfo
  onPreview: (sampleId: string, sampleIdDisplay: string) => void
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'Chưa cập nhật'

  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function CoAAccessSampleCard({ sample, onPreview }: CoAAccessSampleCardProps) {
  return (
    <article className="min-w-0 rounded-lg border border-[#DDE4E1] bg-white p-4 shadow-[0_3px_12px_rgba(23,32,29,0.03)] sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold leading-6 text-[#17201D]">
            {sample.sample_id_display}
          </h2>
          <p className="mt-1 break-words text-sm leading-5 text-[#65716D]">
            {sample.sample_type || 'Mẫu xét nghiệm'}
          </p>
        </div>

        {sample.has_coa ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#B8D8CF] bg-[#EEF7F4] px-2.5 py-1 text-xs font-semibold text-[#087F6A]">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Hoàn thành
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <Clock3
              data-testid="coa-pending-icon"
              className="size-3.5"
              aria-hidden="true"
            />
            Đang xử lý
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#E5EAE8] pt-4">
        <div className="min-w-0">
          <dt className="text-xs font-medium leading-5 text-[#7A8581]">Ngày nhận mẫu</dt>
          <dd className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#35413D] sm:text-sm">
            {formatDate(sample.received_date)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium leading-5 text-[#7A8581]">
            {sample.has_coa ? 'Ngày phê duyệt' : 'Trạng thái'}
          </dt>
          <dd className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#35413D] sm:text-sm">
            {sample.has_coa ? formatDate(sample.approved_at) : 'Đang phân tích'}
          </dd>
        </div>
      </dl>

      {sample.has_coa && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => onPreview(sample.id, sample.sample_id_display)}
            className="h-11 w-full rounded-lg bg-[#087F6A] px-4 font-semibold text-white hover:bg-[#066B5A] sm:w-auto"
          >
            <FileText className="mr-2 size-4" aria-hidden="true" />
            Xem phiếu kết quả
          </Button>
        </div>
      )}
    </article>
  )
}
