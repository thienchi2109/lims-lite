/**
 * CoA Access Portal - Public Page
 *
 * Phase 6: Frontend - Public Portal
 *
 * Public-facing page for clients to access their Certificate of Analysis reports
 * using phone number authentication (simplified, professional design)
 */

import { CoAAccessForm } from '@/components/coa-access-form'
import { FileText, Shield, Clock } from 'lucide-react'

export default function CoAAccessPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
            {/* Header */}
            <header className="border-b border-cyan-100/50 bg-white/80 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900">
                                Cổng Tra Cứu Giấy Chứng Nhận
                            </h1>
                            <p className="text-sm text-slate-600">
                                Hệ thống quản lý kết quả xét nghiệm
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid lg:grid-cols-[1fr,400px] gap-8 items-start">
                    {/* Left: Information */}
                    <div className="space-y-8">
                        {/* Welcome Section */}
                        <div>
                            <h2 className="text-3xl font-semibold text-slate-900 mb-3">
                                Truy Cập Kết Quả Xét Nghiệm
                            </h2>
                            <p className="text-lg text-slate-600">
                                Nhập số điện thoại để xem và tải về giấy chứng nhận kết quả xét nghiệm của bạn
                            </p>
                        </div>

                        {/* Features */}
                        <div className="grid sm:grid-cols-3 gap-4">
                            <FeatureCard
                                icon={<Shield className="w-6 h-6 text-cyan-600" />}
                                title="Bảo mật cao"
                                description="Thông tin được mã hóa và bảo vệ theo tiêu chuẩn 21 CFR Part 11"
                            />
                            <FeatureCard
                                icon={<FileText className="w-6 h-6 text-cyan-600" />}
                                title="Giấy chứng nhận chính thức"
                                description="Tải về PDF có chữ ký số hợp lệ của phòng xét nghiệm"
                            />
                            <FeatureCard
                                icon={<Clock className="w-6 h-6 text-cyan-600" />}
                                title="Truy cập mọi lúc"
                                description="Xem kết quả 24/7 ngay khi mẫu được phê duyệt"
                            />
                        </div>

                        {/* Instructions */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                                Hướng Dẫn Truy Cập
                            </h3>
                            <ol className="space-y-3">
                                <InstructionStep
                                    number="1"
                                    title="Nhập số điện thoại"
                                    description="Sử dụng số điện thoại bạn đã cung cấp khi gửi mẫu xét nghiệm"
                                />
                                <InstructionStep
                                    number="2"
                                    title="Xem danh sách mẫu"
                                    description="Hệ thống sẽ hiển thị tất cả các mẫu đã hoàn thành xét nghiệm"
                                />
                                <InstructionStep
                                    number="3"
                                    title="Tải về giấy chứng nhận"
                                    description="Nhấn nút 'Tải về' để lưu file PDF chính thức"
                                />
                            </ol>
                        </div>

                        {/* Important Notice */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                                        <span className="text-white text-sm font-bold">!</span>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-amber-900 mb-1">
                                        Lưu ý quan trọng
                                    </h4>
                                    <p className="text-sm text-amber-800">
                                        Nếu nhập sai số điện thoại quá 5 lần, hệ thống sẽ tạm khóa truy cập trong 15 phút để bảo vệ thông tin của bạn.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Login Form */}
                    <div className="lg:sticky lg:top-8">
                        <CoAAccessForm />
                    </div>
                </div>

                {/* Support Contact */}
                <div className="mt-12 text-center">
                    <div className="inline-flex flex-col items-center gap-2 px-6 py-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-sm text-slate-600">
                            Cần hỗ trợ?
                        </p>
                        <a
                            href="tel:1900xxxx"
                            className="text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
                        >
                            Liên hệ phòng xét nghiệm: 1900 xxxx
                        </a>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-16 border-t border-slate-200 bg-white/50 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <p className="text-center text-sm text-slate-500">
                        © 2024 Hệ thống CDC-LIMS. Tuân thủ tiêu chuẩn 21 CFR Part 11.
                    </p>
                </div>
            </footer>
        </div>
    )
}

// ============================================================================
// FEATURE CARD COMPONENT
// ============================================================================

interface FeatureCardProps {
    icon: React.ReactNode
    title: string
    description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-cyan-300 hover:shadow-md transition-all cursor-pointer">
            <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-lg bg-cyan-50 flex items-center justify-center">
                    {icon}
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900 mb-1">
                        {title}
                    </h3>
                    <p className="text-sm text-slate-600">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// INSTRUCTION STEP COMPONENT
// ============================================================================

interface InstructionStepProps {
    number: string
    title: string
    description: string
}

function InstructionStep({ number, title, description }: InstructionStepProps) {
    return (
        <li className="flex gap-4">
            <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                    {number}
                </div>
            </div>
            <div className="flex-1 pt-0.5">
                <h4 className="font-medium text-slate-900 mb-1">
                    {title}
                </h4>
                <p className="text-sm text-slate-600">
                    {description}
                </p>
            </div>
        </li>
    )
}
