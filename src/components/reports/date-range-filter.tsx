'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, startOfWeek, startOfMonth, endOfDay } from 'date-fns'

export type DateRangePreset = 'today' | 'week' | 'month' | 'custom'

type DateRangeFilterProps = {
  fromDate?: string
  toDate?: string
}

function getActivePresetForDates(from: string, to: string): DateRangePreset | null {
  if (!from || !to) return null

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')

  if (from === todayStr && to === todayStr) return 'today'
  if (from === weekStart && to === todayStr) return 'week'
  if (from === monthStart && to === todayStr) return 'month'
  return 'custom'
}

export function DateRangeFilter({
  fromDate = '',
  toDate = '',
}: DateRangeFilterProps) {
  const [fromDateValue, setFromDateValue] = useState(fromDate)
  const [toDateValue, setToDateValue] = useState(toDate)
  const [activePreset, setActivePreset] = useState<DateRangePreset | null>(null)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const detectActivePreset = useCallback((from: string, to: string) => {
    setActivePreset(getActivePresetForDates(from, to))
  }, [])

  // Keep inputs in sync with URL changes
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setFromDateValue(fromDate)
      setToDateValue(toDate)
      detectActivePreset(fromDate, toDate)
    })

    return () => {
      cancelled = true
    }
  }, [fromDate, toDate, detectActivePreset])

  const updateUrl = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const handleDateChange = (key: 'fromDate' | 'toDate', value: string) => {
    if (key === 'fromDate') setFromDateValue(value)
    else setToDateValue(value)

    // When manually changing dates, switch to custom preset
    setActivePreset('custom')

    updateUrl({ [key]: value || null })
  }

  const setDateRange = (preset: DateRangePreset) => {
    const today = new Date()
    let from = ''
    let to = format(endOfDay(today), 'yyyy-MM-dd')

    switch (preset) {
      case 'today':
        from = format(today, 'yyyy-MM-dd')
        to = format(today, 'yyyy-MM-dd')
        break
      case 'week':
        // Week starts on Monday (Vietnamese standard)
        from = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        break
      case 'month':
        from = format(startOfMonth(today), 'yyyy-MM-dd')
        break
    }

    setFromDateValue(from)
    setToDateValue(to)
    setActivePreset(preset)
    updateUrl({ fromDate: from, toDate: to })
    setIsPopoverOpen(false)
  }

  const handleReset = () => {
    setFromDateValue('')
    setToDateValue('')
    setActivePreset(null)
    updateUrl({ fromDate: null, toDate: null })
  }

  const isFiltered = fromDateValue || toDateValue

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick Filter Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant={activePreset === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('today')}
          className={cn(
            'h-9 transition-all',
            activePreset === 'today'
              ? 'bg-sky-600/90 hover:bg-sky-700/90 text-white shadow-md backdrop-blur-sm'
              : 'border-slate-200 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20'
          )}
        >
          Hôm nay
        </Button>
        <Button
          variant={activePreset === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('week')}
          className={cn(
            'h-9 transition-all',
            activePreset === 'week'
              ? 'bg-sky-600/90 hover:bg-sky-700/90 text-white shadow-md backdrop-blur-sm'
              : 'border-slate-200 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20'
          )}
        >
          Tuần này
        </Button>
        <Button
          variant={activePreset === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDateRange('month')}
          className={cn(
            'h-9 transition-all',
            activePreset === 'month'
              ? 'bg-sky-600/90 hover:bg-sky-700/90 text-white shadow-md backdrop-blur-sm'
              : 'border-slate-200 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20'
          )}
        >
          Tháng này
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Custom Date Range Picker */}
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-9 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm font-normal transition-all',
              activePreset === 'custom' && 'border-sky-500/50 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400'
            )}
          >
            <Calendar className="mr-2 h-3.5 w-3.5" />
            {activePreset === 'custom' ? 'Tùy chỉnh' : 'Chọn khoảng'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="font-medium text-sm">Khoảng thời gian tùy chỉnh</h4>
              <p className="text-xs text-muted-foreground">
                Chọn ngày bắt đầu và kết thúc
              </p>
            </div>
            <Separator />
            <div className="grid gap-3">
              <div className="grid grid-cols-3 items-center gap-2">
                <label htmlFor="from-date" className="text-xs font-medium">
                  Từ ngày
                </label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDateValue}
                  onChange={(e) => handleDateChange('fromDate', e.target.value)}
                  className="col-span-2 h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <label htmlFor="to-date" className="text-xs font-medium">
                  Đến ngày
                </label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDateValue}
                  onChange={(e) => handleDateChange('toDate', e.target.value)}
                  className="col-span-2 h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reset Button */}
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-9 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}
