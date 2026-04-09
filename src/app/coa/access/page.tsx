/**
 * CoA Access Portal - Public Page
 *
 * Phase 6: Frontend - Public Portal
 *
 * Public-facing page for clients to access their Certificate of Analysis reports
 * using phone number authentication (simplified, professional design)
 */

import { CoAAccessForm } from '@/components/coa-access-form'
import { FileText, Shield, Clock, CheckCircle2, Phone, Search, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

export default function CoAAccessPage() {
    return (
        <div className="min-h-screen bg-white relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">

            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/50 to-white -z-10" />
            <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-blue-100/30 rounded-full blur-3xl -z-10" />
            <div className="absolute top-[200px] left-[-50px] w-72 h-72 bg-cyan-100/30 rounded-full blur-3xl -z-10" />

            {/* Header / Brand */}
            <header className="relative z-10 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-bold text-slate-900 leading-tight tracking-tight">
                                Hệ Thống CDC LIMS
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                                Cổng Tra Cứu Kết Quả
                            </span>
                        </div>
                    </div>

                    <div className="text-sm font-medium text-slate-600 hidden sm:flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                            <Phone className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-400 block leading-none mb-0.5">Hotline hỗ trợ</span>
                            <span className="text-blue-700 font-bold">0292 3822 351</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative z-10 w-full">

                {/* Top Row: Hero & Search Form */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 lg:pt-20 lg:pb-12 text-center">

                    {/* Hero Text */}
                    <div className="max-w-3xl mx-auto mb-10 space-y-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wide shadow-sm">
                            <Shield className="w-3.5 h-3.5 text-blue-500" />
                            <span>Bảo Mật · Chính Xác · Nhanh Chóng</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                            Tra Cứu Kết Quả <br className="hidden sm:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                                Xét Nghiệm Trực Tuyến
                            </span>
                        </h1>

                        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            Hệ thống trả kết quả xét nghiệm điện tử đạt chuẩn <strong>21 CFR Part 11</strong>. <br className="hidden sm:block" />
                            Nhập số điện thoại để xem và tải về giấy chứng nhận chính thức.
                        </p>
                    </div>

                    {/* Search Form Container - Widened for better result display */}
                    <div className="max-w-xl mx-auto relative mb-12">
                        <CoAAccessForm />

                        <div className="mt-6 text-center">
                            <p className="text-xs text-slate-400">
                                Bằng việc tra cứu, bạn đồng ý với <Link href="#" className="underline hover:text-slate-600 transition-colors">Điều khoản sử dụng</Link> và <Link href="#" className="underline hover:text-slate-600 transition-colors">Chính sách bảo mật</Link> của chúng tôi.
                            </p>
                        </div>
                    </div>

                    {/* Notice Card Centered */}
                    <div className="max-w-xl mx-auto bg-amber-50/80 border border-amber-100 rounded-xl p-4 flex gap-3 text-left items-start backdrop-blur-sm">
                        <div className="flex-shrink-0 mt-0.5">
                            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                                <span className="text-amber-600 text-xs font-bold">!</span>
                            </div>
                        </div>
                        <p className="text-sm text-amber-900 leading-snug">
                            <span className="font-semibold">Lưu ý bảo mật:</span> Hệ thống sẽ tạm khóa truy cập trong 15 phút nếu nhập sai số điện thoại quá 5 lần liên tiếp để bảo vệ dữ liệu của bạn.
                        </p>
                    </div>

                </div>

                {/* Bottom Row: Information & Features */}
                <div className="bg-slate-50 border-t border-slate-200">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

                        <div className="text-center mb-12">
                            <h2 className="text-2xl font-bold text-slate-900">Tại sao nên tra cứu trực tuyến?</h2>
                            <p className="text-slate-500 mt-2">Tiện ích vượt trội dành cho khách hàng của CDC</p>
                        </div>

                        {/* Features Grid */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <FeatureCard
                                icon={Shield}
                                title="Bảo mật tuyệt đối"
                                description="Mã hóa đầu cuối, tuân thủ tiêu chuẩn FDA 21 CFR Part 11 về hồ sơ điện tử."
                                color="bg-blue-100 text-blue-600"
                            />
                            <FeatureCard
                                icon={CheckCircle2}
                                title="Chứng nhận hợp lệ"
                                description="File PDF có chữ ký số CA, có giá trị pháp lý tương đương bản giấy."
                                color="bg-emerald-100 text-emerald-600"
                            />
                            <FeatureCard
                                icon={Clock}
                                title="Thời gian thực"
                                description="Nhận kết quả ngay lập tức sau khi mẫu được phê duyệt bởi phòng lab."
                                color="bg-amber-100 text-amber-600"
                            />
                            <FeatureCard
                                icon={Search}
                                title="Tra cứu dễ dàng"
                                description="Chỉ cần số điện thoại đăng ký, không cần tạo tài khoản hay nhớ mật khẩu."
                                color="bg-purple-100 text-purple-600"
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* Simple Footer */}
            <footer className="w-full py-8 text-center bg-slate-50 border-t border-slate-200">
                <p className="text-xs text-slate-400 font-medium">
                    &copy; {new Date().getFullYear()} Trung tâm Kiểm soát Bệnh tật (CDC). All rights reserved.
                </p>
                <p className="text-[10px] text-slate-300 mt-2">
                    Powered by CDC LIMS Platform
                </p>
            </footer>
        </div>
    )
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

function FeatureCard({ icon: Icon, title, description, color }: { icon: LucideIcon, title: string, description: string, color: string }) {
    return (
        <div className="group p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-200 transition-all duration-300">
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-2">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
    )
}
