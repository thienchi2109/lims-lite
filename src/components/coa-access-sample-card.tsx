'use client'

import { CheckCircle, Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { CoASampleInfo } from '@/types'

interface CoAAccessSampleCardProps {
  sample: CoASampleInfo
  onPreview: (sampleId: string, sampleIdDisplay: string) => void
}

export function CoAAccessSampleCard({ sample, onPreview }: CoAAccessSampleCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div className="group relative cursor-default rounded-xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50">
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-colors ${sample.has_coa ? 'bg-green-500' : 'bg-amber-400'}`} />

      <div className="flex flex-col gap-4 pl-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-slate-900">
                {sample.sample_id_display}
              </h3>
              {sample.has_coa ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">
                  <CheckCircle className="h-3 w-3" /> Hoàn thành
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                  <Loader2 className="h-3 w-3 animate-spin" /> Đang xử lý
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-600">
              {sample.sample_type || 'Mẫu xét nghiệm'}
            </p>
          </div>

          <div className="hidden sm:block">
            {sample.has_coa && (
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview(sample.id, sample.sample_id_display)
                }}
                size="sm"
                className="bg-blue-600 font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-blue-200"
              >
                <Download className="mr-2 h-4 w-4" />
                Tải Kết Quả
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Ngày nhận mẫu
            </span>
            <div className="text-sm font-semibold text-slate-700">
              {formatDate(sample.received_date)}
            </div>
          </div>
          <div>
            {sample.has_coa && sample.approved_at ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Ngày trả kết quả
                </span>
                <div className="text-sm font-semibold text-slate-700">
                  {formatDate(sample.approved_at)}
                </div>
              </>
            ) : sample.has_coa ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Trạng thái
                </span>
                <div className="text-sm font-semibold text-slate-700">Đang cập nhật</div>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Trạng thái
                </span>
                <div className="text-sm font-semibold text-slate-700">Đang phân tích</div>
              </>
            )}
          </div>
        </div>

        <div className="sm:hidden mt-2">
          {sample.has_coa ? (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onPreview(sample.id, sample.sample_id_display)
              }}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Tải Kết Quả
            </Button>
          ) : (
            <div className="w-full rounded border border-amber-100 bg-amber-50 py-2 text-center text-xs font-medium text-amber-600">
              Kết quả đang được xử lý
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
