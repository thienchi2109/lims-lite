/**
 * QR Code Access Page
 *
 * Manager page to generate and print QR codes for the public CoA portal
 */

import Link from 'next/link'
import { PortalQRCode } from '@/components/portal-qr-code'
import { ArrowLeft, QrCode, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function QRCodePage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden font-sans">
            {/* Background Decorations - Same as Reports page */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-sky-50/80 to-transparent dark:from-sky-950/20 pointer-events-none" />
            <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-[200px] left-[-100px] w-[300px] h-[300px] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 relative z-10">
                {/* Back Button */}
                <Link
                    href="/manager"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Quay lại bảng điều khiển</span>
                </Link>

                {/* Page Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                        <QrCode className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Mã QR Cổng Tra Cứu
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400">
                            Tạo và in mã QR cho khách hàng truy cập kết quả xét nghiệm
                        </p>
                    </div>
                </div>

                {/* Info Alert */}
                <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-900">
                        <strong>Lưu ý:</strong> Khách hàng có thể quét mã QR này để truy cập cổng tra cứu giấy chứng nhận.
                        Sau đó họ chỉ cần nhập số điện thoại để xem và tải về kết quả xét nghiệm.
                    </AlertDescription>
                </Alert>

                {/* QR Code Section */}
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Main QR Code Card */}
                    <div>
                        <PortalQRCode
                            size={300}
                            showInstructions={true}
                            variant="card"
                        />
                    </div>

                    {/* Usage Guide */}
                    <div className="space-y-6">
                        {/* Use Cases */}
                        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                                Cách sử dụng mã QR
                            </h3>
                            <div className="space-y-4">
                                <UseCase
                                    title="1. Tại quầy tiếp nhận"
                                    description="In và đặt mã QR tại quầy lễ tân hoặc khu vực tiếp nhận mẫu"
                                />
                                <UseCase
                                    title="2. Tờ rơi thông tin"
                                    description="Đưa cho khách hàng kèm theo biên nhận khi nhận mẫu xét nghiệm"
                                />
                                <UseCase
                                    title="3. Trên giấy chứng nhận"
                                    description="In trực tiếp lên giấy chứng nhận để khách hàng dễ dàng chia sẻ"
                                />
                                <UseCase
                                    title="4. Website/Mạng xã hội"
                                    description="Chia sẻ hình ảnh mã QR trên website hoặc fanpage của phòng xét nghiệm"
                                />
                            </div>
                        </div>

                        {/* Benefits */}
                        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                                Lợi ích của việc sử dụng QR Code
                            </h3>
                            <ul className="space-y-2 text-sm text-slate-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-600 mt-0.5">✓</span>
                                    <span><strong>Tiện lợi:</strong> Khách hàng không cần nhớ hoặc gõ link dài</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-600 mt-0.5">✓</span>
                                    <span><strong>Nhanh chóng:</strong> Truy cập ngay chỉ trong 2 bước (quét + nhập SĐT)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-600 mt-0.5">✓</span>
                                    <span><strong>Chuyên nghiệp:</strong> Tạo ấn tượng về công nghệ hiện đại</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-600 mt-0.5">✓</span>
                                    <span><strong>Giảm tải:</strong> Ít cuộc gọi hỏi về cách truy cập kết quả</span>
                                </li>
                            </ul>
                        </div>

                        {/* Security Note */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                                        <span className="text-white text-sm font-bold">!</span>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-amber-900 mb-1">
                                        Bảo mật thông tin
                                    </h4>
                                    <p className="text-sm text-amber-800">
                                        Mã QR chỉ dẫn đến trang đăng nhập, không chứa thông tin cá nhân.
                                        Khách hàng vẫn phải nhập số điện thoại để xác thực và xem kết quả.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// USE CASE COMPONENT
// ============================================================================

interface UseCaseProps {
    title: string
    description: string
}

function UseCase({ title, description }: UseCaseProps) {
    return (
        <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                <QrCode className="w-4 h-4 text-cyan-600" />
            </div>
            <div>
                <h4 className="font-medium text-slate-900 mb-1">{title}</h4>
                <p className="text-sm text-slate-600">{description}</p>
            </div>
        </div>
    )
}
