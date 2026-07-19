'use client'

import { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Loader2,
  LogOut,
  Phone,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { CoAAccessSampleCard } from '@/components/coa-access-sample-card'
import { CoAPreviewDialog } from '@/components/coa-preview-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CoAAuthResponse, CoASampleInfo } from '@/types'

const CoAAccessFormSchema = z.object({
  phone: z
    .string()
    .min(10, 'Số điện thoại không hợp lệ')
    .max(15, 'Số điện thoại không hợp lệ')
    .regex(/^(0|\+?84)[0-9]{9,10}$/, 'Số điện thoại không đúng định dạng'),
})

type CoAAccessFormData = z.infer<typeof CoAAccessFormSchema>

interface CoAAccessFormProps {
  onAuthenticatedChange?: (authenticated: boolean) => void
}

export function CoAAccessForm({ onAuthenticatedChange }: CoAAccessFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authResponse, setAuthResponse] = useState<CoAAuthResponse | null>(null)
  const [previewSample, setPreviewSample] = useState<{
    sampleId: string
    sampleIdDisplay: string
  } | null>(null)
  const previewScrollPosition = useRef(0)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CoAAccessFormData>({
    resolver: zodResolver(CoAAccessFormSchema),
    defaultValues: { phone: '' },
  })

  const onSubmit = async (data: CoAAccessFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/coa/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result: CoAAuthResponse = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Không tìm thấy thông tin khách hàng')
        setAuthResponse(null)
        return
      }

      setAuthResponse(result)
      setError(null)
      onAuthenticatedChange?.(true)
    } catch (authError) {
      console.error('Auth error:', authError)
      setError('Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreviewOpen = (sampleId: string, sampleIdDisplay: string) => {
    previewScrollPosition.current = window.scrollY
    setPreviewSample({ sampleId, sampleIdDisplay })
  }

  const handlePreviewOpenChange = (open: boolean) => {
    if (open) return

    setPreviewSample(null)
    requestAnimationFrame(() => {
      if (window.scrollY !== previewScrollPosition.current) {
        window.scrollTo({ top: previewScrollPosition.current, behavior: 'auto' })
      }
    })
  }

  const handleLogout = useCallback(() => {
    void fetch('/api/coa/logout', { method: 'POST' })
    setPreviewSample(null)
    setAuthResponse(null)
    setError(null)
    reset()
    onAuthenticatedChange?.(false)
  }, [onAuthenticatedChange, reset])

  const handleUnauthorizedPreviewRecovery = useCallback(() => {
    handleLogout()
  }, [handleLogout])

  if (authResponse?.success) {
    const sampleCount = authResponse.samples?.length ?? 0

    return (
      <>
        <section className="overflow-hidden rounded-lg border border-[#DDE4E1] bg-white shadow-[0_8px_28px_rgba(23,32,29,0.05)]">
          <header className="flex items-start justify-between gap-4 border-b border-[#DDE4E1] px-4 py-4 sm:items-center sm:px-6">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F3F0] text-sm font-bold text-[#087F6A]">
                  {(authResponse.client_name || 'K').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold text-[#17201D] sm:text-lg">
                    {authResponse.client_name || 'Khách hàng'}
                  </h1>
                  <p className="mt-0.5 text-sm text-[#65716D]">
                    {sampleCount} mẫu xét nghiệm
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              title="Thoát"
              className="h-10 shrink-0 px-3 text-[#65716D] hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="size-4 sm:mr-2" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Thoát</span>
            </Button>
          </header>

          <div className="bg-[#F7F9F8] p-4 sm:p-6">
            {sampleCount > 0 ? (
              <div
                data-testid="coa-results-grid"
                className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2"
              >
                {authResponse.samples?.map((sample: CoASampleInfo) => (
                  <CoAAccessSampleCard
                    key={sample.id}
                    sample={sample}
                    onPreview={handlePreviewOpen}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-lg bg-[#E8F3F0] text-[#087F6A]">
                  <Search className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-semibold text-[#17201D]">Không tìm thấy kết quả</h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-[#65716D]">
                  Hiện chưa có kết quả xét nghiệm nào hoàn thành cho số điện thoại này.
                </p>
              </div>
            )}
          </div>
        </section>

        <CoAPreviewDialog
          open={Boolean(previewSample)}
          onOpenChange={handlePreviewOpenChange}
          sampleId={previewSample?.sampleId ?? ''}
          title="Phiếu Kết Quả Phân Tích"
          subtitle={
            previewSample ? `Mã số mẫu: ${previewSample.sampleIdDisplay}` : undefined
          }
          route="client"
          onUnauthorized={handleUnauthorizedPreviewRecovery}
        />
      </>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#DDE4E1] bg-white shadow-[0_8px_28px_rgba(23,32,29,0.06)]">
      <header className="border-b border-[#DDE4E1] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F3F0] text-[#087F6A]">
            <Phone className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#17201D]">Tra cứu bằng số điện thoại</h2>
            <p className="mt-0.5 text-sm text-[#65716D]">Nhập thông tin đã đăng ký gửi mẫu</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-5 sm:p-6">
        {error && (
          <Alert
            variant="destructive"
            className="border-red-200 bg-red-50 animate-in fade-in slide-in-from-top-2"
          >
            <XCircle className="size-4 text-red-600" />
            <AlertDescription className="font-medium text-red-900">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 text-left">
          <Label htmlFor="phone" className="text-sm font-semibold text-[#35413D]">
            Số điện thoại đăng ký <span className="text-red-600">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ví dụ: 0987654321"
            {...register('phone')}
            disabled={isLoading}
            className={[
              'h-12 rounded-lg border-[#CCD6D2] px-4 text-base',
              'focus-visible:border-[#087F6A] focus-visible:ring-[#D2E9E3]',
              errors.phone ? 'border-red-300 bg-red-50/40' : '',
            ].join(' ')}
          />
          {errors.phone ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <XCircle className="size-3.5" aria-hidden="true" />
              {errors.phone.message}
            </p>
          ) : (
            <p className="text-xs leading-5 text-[#65716D]">
              Nhập chính xác số điện thoại đã cung cấp khi gửi mẫu.
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-lg bg-[#087F6A] text-base font-semibold text-white shadow-sm hover:bg-[#066B5A] focus-visible:ring-[#087F6A]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" />
              Đang xử lý...
            </>
          ) : (
            <>
              <Search className="mr-2 size-5" aria-hidden="true" />
              Tra Cứu Ngay
            </>
          )}
        </Button>
      </form>

      <footer className="flex items-center justify-center gap-2 border-t border-[#DDE4E1] bg-[#FAFBFA] px-5 py-3.5 text-xs font-medium text-[#65716D]">
        <ShieldCheck className="size-4 text-[#087F6A]" aria-hidden="true" />
        Phiên tra cứu được bảo vệ bởi CDC LIMS
      </footer>
    </section>
  )
}
