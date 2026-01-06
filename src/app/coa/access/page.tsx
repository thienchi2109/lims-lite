/**
 * CoA Access Portal - Public Page
 *
 * Phase 6: Frontend - Public Portal
 *
 * Public-facing page for clients to access their Certificate of Analysis reports
 * using phone number authentication (simplified, professional design)
 */

import { CoAAccessForm } from '@/components/coa-access-form'
import { FileText, Shield, Clock, CheckCircle2, Phone, Search } from 'lucide-react'
import Link from 'next/link'

export default function CoAAccessPage() {
    return (
        <div className="min-h-screen bg-white relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">



            {/* Header / Brand */}
            <header className="relative z-10 w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-sm">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-bold text-slate-900 leading-tight">
                                Hệ Thống CDC LIMS
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                                Cổng Tra Cứu Kết Quả
                            </span>
                        </div>
                    </div>

                    <div className="text-sm font-medium text-slate-600 hidden sm:block">
                        Hỗ trợ: <span className="text-blue-600">0292 3822 351</span>
                    </div>
                </div>
            </header>

            <main className="relative z-10 w-full">

                {/* Top Row: Hero & Search Form */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 lg:pt-20 lg:pb-12 text-center">

                    {/* Hero Text */}
                    <div className="max-w-3xl mx-auto mb-10 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wide">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Bảo Mật · Chính Xác · Nhanh Chóng</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                            Tra Cứu Kết Quả <br className="hidden sm:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                                Xét Nghiệm Trực Tuyến
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            Hệ thống trả kết quả xét nghiệm điện tử đạt chuẩn 21 CFR Part 11. <br className="hidden sm:block" />
                            Nhập số điện thoại để xem và tải về giấy chứng nhận chính thức.
                        </p>
                    </div>

                    {/* Search Form Container - Widened for better result display */}
                    <div className="max-w-2xl mx-auto relative mb-10">
                        <CoAAccessForm />

                        <div className="mt-8 text-center">
                            <p className="text-xs text-slate-400">
                                Bằng việc tra cứu, bạn đồng ý với <Link href="#" className="underline hover:text-slate-600">Điều khoản sử dụng</Link> của chúng tôi.
                            </p>
                        </div>
                    </div>

                    {/* Notice Card Centered */}
                    <div className="max-w-2xl mx-auto bg-blue-50 border border-blue-100 rounded-xl p-5 flex gap-4 text-left">
                        <div className="flex-shrink-0 mt-0.5">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-600 text-sm font-bold">i</span>
                            </div>
                        </div>
                        <p className="text-base text-blue-900 leading-snug">
                            <span className="font-semibold">Lưu ý:</span> Hệ thống sẽ tạm khóa 15 phút nếu nhập sai thông tin quá 5 lần liên tiếp.
                        </p>
                    </div>

                </div>

                {/* Bottom Row: Information & Features */}
                <div className="bg-white/50 border-t border-slate-200/60 backdrop-blur-3xl">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

                        {/* Features Grid */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                            <FeatureCard
                                icon={Shield}
                                title="Bảo mật tuyệt đối"
                                description="Mã hóa đầu cuối, tuân thủ tiêu chuẩn FDA 21 CFR Part 11."
                                color="bg-blue-50 text-blue-600"
                            />
                            <FeatureCard
                                icon={CheckCircle2}
                                title="Chứng nhận hợp lệ"
                                description="File PDF có chữ ký số CA, giá trị pháp lý tương đương bản giấy."
                                color="bg-emerald-50 text-emerald-600"
                            />
                            <FeatureCard
                                icon={Clock}
                                title="Thời gian thực"
                                description="Nhận kết quả ngay lập tức sau khi mẫu được phê duyệt."
                                color="bg-amber-50 text-amber-600"
                            />
                            <FeatureCard
                                icon={Search}
                                title="Tra cứu dễ dàng"
                                description="Chỉ cần số điện thoại đăng ký, không cần tạo tài khoản."
                                color="bg-purple-50 text-purple-600"
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* Simple Footer */}
            <footer className="absolute bottom-0 w-full py-6 text-center text-xs text-slate-400">
                &copy; {new Date().getFullYear()} CDC LIMS. All rights reserved.
            </footer>
        </div>
    )
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

function FeatureCard({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) {
    return (
        <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300">
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm mb-1">{title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>
    )
}

function StepItem({ number, title }: { number: string, title: string }) {
    return (
        <div className="flex flex-col items-center gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xl shadow-slate-200/50 relative z-10 w-full md:w-56 transition-transform hover:-translate-y-1">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-lg ring-4 ring-white">
                {number}
            </div>
            <span className="text-sm font-bold text-slate-800">{title}</span>
        </div>
    )
}
