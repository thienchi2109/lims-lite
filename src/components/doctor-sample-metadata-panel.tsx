'use client'

import type { SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { FileText } from 'lucide-react'

interface DoctorSampleMetadataPanelProps {
    sample: SampleWithUser | null
}

function FieldRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-b-0">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-medium text-slate-900">{value}</span>
        </div>
    )
}

export function DoctorSampleMetadataPanel({ sample }: DoctorSampleMetadataPanelProps) {
    if (!sample) {
        return (
            <div className="flex h-full flex-col items-center justify-center rounded-lg bg-slate-50 p-8 text-slate-500">
                <FileText className="mb-4 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Chọn một mẫu đã hoàn thành để xem thông tin</p>
            </div>
        )
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-xs font-medium uppercase text-slate-500">Mã mẫu xét nghiệm</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{sample.sample_id}</h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <FieldRow label="Trạng thái" value="Hoàn thành" />
                <FieldRow label="Khách hàng" value={sample.client_name || 'N/A'} />
                <FieldRow label="Loại mẫu" value={sample.type || 'N/A'} />
                <FieldRow label="Thời điểm nhận" value={formatDate(sample.received_at)} />
                <FieldRow label="Người nhận mẫu" value={sample.received_by_name || 'N/A'} />
                <FieldRow label="Cập nhật cuối" value={formatDate(sample.updated_at)} />
            </div>
        </div>
    )
}
