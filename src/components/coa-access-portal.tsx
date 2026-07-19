'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  BadgeCheck,
  Clock3,
  FileCheck2,
  Headphones,
  LockKeyhole,
  Search,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import { CoAAccessForm } from '@/components/coa-access-form'

interface CoAAccessPortalProps {
  currentYear?: number
}

interface TrustFeature {
  title: string
  description: string
  icon: LucideIcon
}

const trustFeatures: TrustFeature[] = [
  {
    title: 'Bảo mật thông tin',
    description: 'Phiên tra cứu được bảo vệ và tự động kết thúc khi hết hạn.',
    icon: LockKeyhole,
  },
  {
    title: 'Phiếu kết quả chính thức',
    description: 'Xem trực tiếp phiếu đã được phê duyệt bởi phòng xét nghiệm.',
    icon: BadgeCheck,
  },
  {
    title: 'Cập nhật kịp thời',
    description: 'Kết quả hiển thị ngay sau khi hoàn tất quy trình phê duyệt.',
    icon: Clock3,
  },
  {
    title: 'Tra cứu thuận tiện',
    description: 'Không cần tài khoản, chỉ dùng số điện thoại đã đăng ký.',
    icon: Search,
  },
]

export function CoAAccessPortal({
  currentYear = new Date().getFullYear(),
}: CoAAccessPortalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  return (
    <main className="flex min-h-dvh flex-col bg-[#F7F9F8] font-sans text-[#17201D] selection:bg-[#D2E9E3] selection:text-[#17483D]">
      <header className="border-b border-[#DDE4E1] bg-white">
        <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Image
              src="/cdc-logo-400x400.png"
              alt="Biểu trưng Trung tâm Kiểm soát bệnh tật"
              width={64}
              height={64}
              className="size-12 shrink-0 object-contain sm:size-14"
              priority
            />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-6 text-[#17201D] sm:text-xl">
                CDC Cần Thơ
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[#65716D] sm:text-sm">
                Cổng tra cứu kết quả xét nghiệm
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 text-right md:flex">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#E8F3F0] text-[#087F6A]">
              <Headphones className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs text-[#65716D]">Hỗ trợ tra cứu</p>
              <p className="text-sm font-semibold text-[#17201D]">0292 3822 351</p>
            </div>
          </div>
        </div>
      </header>

      <section
        className={[
          'mx-auto w-full max-w-[1360px] flex-1 px-5 sm:px-8 lg:px-12',
          isAuthenticated ? 'py-5 sm:py-8' : 'py-8 sm:py-10 lg:py-12',
        ].join(' ')}
      >
        <div
          data-testid={isAuthenticated ? 'coa-authenticated-workspace' : undefined}
          className={[
            'grid items-start',
            isAuthenticated
              ? 'grid-cols-1'
              : 'grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.7fr)] lg:gap-12 xl:gap-20',
          ].join(' ')}
        >
          <div className={isAuthenticated ? 'hidden' : 'lg:pt-4'}>
            {!isAuthenticated && (
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#087F6A]">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Dịch vụ trực tuyến của CDC Cần Thơ
                </div>

                <h1 className="mt-5 max-w-[18ch] text-3xl font-bold leading-10 text-[#17201D] sm:text-4xl sm:leading-[3rem]">
                  Tra cứu kết quả xét nghiệm
                </h1>
                <p className="mt-4 max-w-[42ch] text-lg font-medium leading-7 text-[#35413D]">
                  Tra cứu an toàn, nhận kết quả chính thức
                </p>
                <p className="mt-3 max-w-[58ch] text-base leading-7 text-[#65716D]">
                  Sử dụng số điện thoại đã đăng ký khi gửi mẫu để xem danh sách kết quả và
                  phiếu phân tích đã được phê duyệt.
                </p>

                <div className="mt-7 hidden gap-3 lg:grid lg:grid-cols-1 xl:grid-cols-2">
                  <div className="flex items-center gap-3 border-t border-[#DDE4E1] pt-4">
                    <FileCheck2 className="size-5 shrink-0 text-[#087F6A]" aria-hidden="true" />
                    <span className="text-sm font-medium text-[#35413D]">
                      Phiếu kết quả được phê duyệt
                    </span>
                  </div>
                  <div className="flex items-center gap-3 border-t border-[#DDE4E1] pt-4">
                    <ShieldCheck className="size-5 shrink-0 text-[#087F6A]" aria-hidden="true" />
                    <span className="text-sm font-medium text-[#35413D]">
                      Bảo vệ dữ liệu khách hàng
                    </span>
                  </div>
                </div>

                <div className="mt-7 hidden rounded-lg border border-[#D9E3DF] bg-[#EEF5F2] p-4 lg:block">
                  <div className="flex gap-3">
                    <LockKeyhole
                      className="mt-0.5 size-5 shrink-0 text-[#087F6A]"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-6 text-[#35413D]">
                      Hệ thống tạm khóa truy cập trong 15 phút sau 5 lần nhập sai liên tiếp
                      để bảo vệ thông tin xét nghiệm.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <CoAAccessForm onAuthenticatedChange={setIsAuthenticated} />
            {!isAuthenticated && (
              <>
                <p className="mt-4 text-center text-xs leading-5 text-[#7A8581]">
                  Chỉ sử dụng số điện thoại của người đã đăng ký gửi mẫu.
                </p>
                <div className="mt-4 rounded-lg border border-[#D9E3DF] bg-[#EEF5F2] p-4 lg:hidden">
                  <div className="flex gap-3">
                    <LockKeyhole
                      className="mt-0.5 size-5 shrink-0 text-[#087F6A]"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-6 text-[#35413D]">
                      Hệ thống tạm khóa truy cập trong 15 phút sau 5 lần nhập sai liên tiếp
                      để bảo vệ thông tin xét nghiệm.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {!isAuthenticated && (
          <section className="mt-10 border-t border-[#DDE4E1] pt-8 sm:mt-12 sm:pt-10">
            <div className="mb-5">
              <h2 className="text-lg font-semibold leading-7 text-[#17201D]">
                Thông tin về dịch vụ
              </h2>
            </div>

            <div
              data-testid="coa-feature-grid"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {trustFeatures.map((feature) => {
                const Icon = feature.icon

                return (
                  <article
                    key={feature.title}
                    className="flex gap-4 rounded-lg border border-[#DDE4E1] bg-white p-4 shadow-[0_4px_14px_rgba(23,32,29,0.03)] sm:min-h-36 sm:flex-col sm:p-5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F3F0] text-[#087F6A]">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold leading-6 text-[#17201D]">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-[#65716D]">
                        {feature.description}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </section>

      <footer className="border-t border-[#DDE4E1] bg-white">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-1 px-5 py-5 text-sm text-[#65716D] sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <p>&copy; {currentYear} Trung tâm Kiểm soát bệnh tật thành phố Cần Thơ</p>
          <p>Khoa Xét nghiệm</p>
        </div>
      </footer>
    </main>
  )
}
