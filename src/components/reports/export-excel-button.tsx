'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { utils, writeFile } from 'xlsx'
import { format, isValid, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { type SampleStatus } from '@/types'

// Type definitions for export data
export interface KPIExportData {
  metric: string
  value: string | number
  unit?: string
  trend?: string
}

export interface SampleExportData {
  sample_id: string
  client_name: string | null
  received_at: string
  approved_at: string | null
  tat_hours: number | null
  status: SampleStatus
}

export interface CoAExportData {
  segment: string
  count: number
  percentage: number
}

interface ExportExcelButtonProps {
  kpiData?: KPIExportData[]
  samplesData?: SampleExportData[]
  coaData?: CoAExportData[]
  dateRange?: {
    fromDate?: string
    toDate?: string
  }
  disabled?: boolean
}

const EMPTY_KPI: KPIExportData[] = []
const EMPTY_SAMPLES: SampleExportData[] = []
const EMPTY_COA: CoAExportData[] = []

export function ExportExcelButton({
  kpiData = EMPTY_KPI,
  samplesData = EMPTY_SAMPLES,
  coaData = EMPTY_COA,
  dateRange,
  disabled = false,
}: ExportExcelButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    try {
      // Create a new workbook
      const workbook = utils.book_new()

      // Sheet 1: KPI Metrics (Chỉ số hiệu suất)
      if (kpiData.length > 0) {
        const kpiSheet = utils.json_to_sheet(
          kpiData.map(item => ({
            'Chỉ số': item.metric,
            'Giá trị': item.value,
            'Đơn vị': item.unit || '',
            'Xu hướng': item.trend || '',
          }))
        )
        utils.book_append_sheet(workbook, kpiSheet, 'Chỉ số hiệu suất')
      }

      // Sheet 2: Samples Data (Dữ liệu mẫu)
      if (samplesData.length > 0) {
        const samplesSheet = utils.json_to_sheet(
          samplesData.map(sample => {
            // Validate dates before formatting
            const receivedDate = sample.received_at ? parseISO(sample.received_at) : null
            const approvedDate = sample.approved_at ? parseISO(sample.approved_at) : null

            return {
              'Mã mẫu': sample.sample_id,
              'Khách hàng': sample.client_name || '-',
              'Ngày nhận': receivedDate && isValid(receivedDate)
                ? format(receivedDate, 'dd/MM/yyyy HH:mm')
                : '-',
              'Ngày duyệt': approvedDate && isValid(approvedDate)
                ? format(approvedDate, 'dd/MM/yyyy HH:mm')
                : '-',
              'TAT (giờ)': sample.tat_hours !== null ? sample.tat_hours : '-',
              'Trạng thái': sample.status,
            }
          })
        )
        utils.book_append_sheet(workbook, samplesSheet, 'Dữ liệu mẫu')
      }

      // Sheet 3: CoA Statistics (Thống kê CoA)
      if (coaData.length > 0) {
        const coaSheet = utils.json_to_sheet(
          coaData.map(item => ({
            'Phân loại': item.segment,
            'Số lượng': item.count,
            'Tỷ lệ (%)': item.percentage.toFixed(2),
          }))
        )
        utils.book_append_sheet(workbook, coaSheet, 'Thống kê CoA')
      }

      // Generate filename with date range
      const today = format(new Date(), 'yyyy-MM-dd')
      let filename = `bao-cao-lims-${today}.xlsx`

      if (dateRange?.fromDate && dateRange?.toDate) {
        const fromDate = parseISO(dateRange.fromDate)
        const toDate = parseISO(dateRange.toDate)

        if (isValid(fromDate) && isValid(toDate)) {
          const fromFormatted = format(fromDate, 'ddMMyyyy')
          const toFormatted = format(toDate, 'ddMMyyyy')
          filename = `bao-cao-lims-${fromFormatted}-${toFormatted}.xlsx`
        }
      }

      // Trigger download
      writeFile(workbook, filename)

      toast.success('Đã xuất báo cáo Excel thành công', {
        description: `File: ${filename}`,
      })
    } catch (error) {
      console.error('Excel export error:', error)
      toast.error('Có lỗi khi xuất báo cáo Excel', {
        description: 'Vui lòng thử lại sau',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const hasData = kpiData.length > 0 || samplesData.length > 0 || coaData.length > 0

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || isExporting || !hasData}
      size="sm"
      className="gap-2 bg-green-600/90 hover:bg-green-700/90 text-white shadow-md backdrop-blur-sm transition-all"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Đang xuất...</span>
        </>
      ) : (
        <>
          <FileSpreadsheet className="h-4 w-4" />
          <span>Xuất Excel</span>
        </>
      )}
    </Button>
  )
}
