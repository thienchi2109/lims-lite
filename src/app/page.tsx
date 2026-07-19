/* Hallmark · redesign: CDC access rail · theme: Clinical Integrity
 * pre-emit critique: P5 H4 E5 S5 R5 V4 · equal-3-column: stakeholder override
 */
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, FileSearch, FlaskConical, Package } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Cổng thông tin dành cho CDC',
    robots: { index: false, follow: false },
}

const apps = [
    {
        title: 'CDC LIMS',
        description: 'Hệ thống quản lý thông tin xét nghiệm',
        icon: FlaskConical,
        href: '/login',
        keepTitleSuffixTogether: null,
        external: false,
    },
    {
        title: 'Quản lý TBYT CDC',
        description: 'Quản lý thiết bị y tế CDC',
        icon: Package,
        href: 'https://quan-ly-tbyt.pages.dev/',
        keepTitleSuffixTogether: null,
        external: true,
    },
    {
        title: 'Cổng tra cứu kết quả xét nghiệm',
        description: 'Tra cứu và xác thực phiếu kết quả xét nghiệm',
        icon: FileSearch,
        href: 'https://cdclims.cloud/coa/access',
        keepTitleSuffixTogether: 'xét nghiệm',
        external: true,
    },
] as const

type PortalApp = (typeof apps)[number]

const portalCardClassName = [
    'group flex min-h-[276px] h-full flex-col rounded-lg border border-[#DDE4E1]',
    'bg-white p-6 text-[#17201D] shadow-[0_4px_14px_rgba(23,32,29,0.04)]',
    'transition-[transform,border-color,box-shadow] duration-200 ease-out',
    'hover:-translate-y-1 hover:border-[#A6C9C0] hover:shadow-[0_16px_36px_rgba(23,32,29,0.08)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087F6A]',
    'focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F9F8]',
    'active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none',
].join(' ')

function PortalCard({ app }: { app: PortalApp }) {
    const Icon = app.icon
    const ActionIcon = app.external ? ArrowUpRight : ArrowRight

    const content = (
        <>
            <div className="flex items-start justify-between gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#E8F3F0] text-[#087F6A]">
                    <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="pt-1 text-xs font-semibold uppercase text-[#65716D]">
                    Cổng truy cập
                </span>
            </div>

            <div className="mt-8">
                <h2 className="max-w-[18ch] min-w-0 text-2xl font-semibold leading-8 text-[#17201D]">
                    {app.keepTitleSuffixTogether ? (
                        <>
                            {app.title.slice(0, -app.keepTitleSuffixTogether.length)}
                            <span className="whitespace-nowrap">
                                {app.keepTitleSuffixTogether}
                            </span>
                        </>
                    ) : (
                        app.title
                    )}
                </h2>
                <p className="mt-3 max-w-[36ch] text-base leading-7 text-[#65716D]">
                    {app.description}
                </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-4 border-t border-[#E5EAE8] pt-5">
                <span className="whitespace-nowrap text-sm font-semibold text-[#087F6A]">
                    Truy cập hệ thống
                </span>
                <ActionIcon
                    className="size-5 shrink-0 text-[#087F6A] transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none"
                    aria-hidden="true"
                />
            </div>
        </>
    )

    if (app.external) {
        return (
            <a
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className={portalCardClassName}
                data-portal-card
            >
                {content}
            </a>
        )
    }

    return (
        <Link href={app.href} className={portalCardClassName} data-portal-card>
            {content}
        </Link>
    )
}

export default function PortalPage() {
    return (
        <main className="flex min-h-dvh flex-col bg-[#F7F9F8] font-sans text-[#17201D] selection:bg-[#D2E9E3] selection:text-[#17483D]">
            <header className="border-b border-[#DDE4E1] bg-white">
                <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-6 px-5 py-5 sm:px-8 lg:px-12">
                    <div className="flex min-w-0 items-center gap-4">
                        <Image
                            src="/cdc-logo-400x400.png"
                            alt="Biểu trưng Trung tâm Kiểm soát bệnh tật"
                            width={64}
                            height={64}
                            className="size-14 shrink-0 object-contain sm:size-16"
                            priority
                        />
                        <div className="min-w-0">
                            <h1 className="min-w-0 text-2xl font-bold leading-8 text-[#17201D] sm:text-3xl [overflow-wrap:anywhere]">
                                Cổng thông tin CDC
                            </h1>
                            <p className="mt-1 text-sm leading-5 text-[#65716D] sm:text-base">
                                Trung tâm Kiểm soát bệnh tật thành phố Cần Thơ
                            </p>
                        </div>
                    </div>
                    <p className="hidden shrink-0 text-sm font-medium text-[#65716D] md:block">
                        Hệ thống thông tin trực tuyến
                    </p>
                </div>
            </header>

            <section className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
                <div className="mb-6 sm:mb-8">
                    <h2 className="text-xl font-semibold leading-7 text-[#17201D] sm:text-2xl">
                        Chọn hệ thống cần truy cập
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#65716D] sm:text-base">
                        Ba cổng thông tin chính thức phục vụ công tác chuyên môn và tra cứu kết quả.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
                    {apps.map((app) => (
                        <PortalCard key={app.href} app={app} />
                    ))}
                </div>
            </section>

            <footer className="border-t border-[#DDE4E1] bg-white">
                <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-1 px-5 py-5 text-sm text-[#65716D] sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
                    <p>&copy; {new Date().getFullYear()} Trung tâm Kiểm soát bệnh tật thành phố Cần Thơ</p>
                    <p>Khoa Xét nghiệm</p>
                </div>
            </footer>
        </main>
    )
}
