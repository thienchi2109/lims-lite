/**
 * CoA Access Portal - Public Page
 *
 * Phase 6: Frontend - Public Portal
 *
 * Public-facing page for clients to access their Certificate of Analysis reports
 * using phone number + passcode (last 6 digits) authentication
 */

import { CoAAccessForm } from '@/components/coa-access-form'

export default function CoAAccessPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Truy cập Giấy Chứng Nhận
                    </h1>
                    <p className="text-gray-600">
                        Nhập số điện thoại và mật khẩu để xem kết quả xét nghiệm
                    </p>
                </div>

                {/* CoA Access Form */}
                <CoAAccessForm />

                {/* Instructions */}
                <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">
                        Hướng dẫn truy cập
                    </h2>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                        <li>Nhập số điện thoại đã đăng ký với phòng xét nghiệm</li>
                        <li>Nhập mật khẩu (6 chữ số cuối của số điện thoại)</li>
                        <li>Nhấn "Truy cập" để xem danh sách mẫu xét nghiệm</li>
                        <li>Chọn mẫu cần tải về giấy chứng nhận</li>
                    </ol>

                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-sm text-amber-800">
                            <strong>Lưu ý:</strong> Nếu bạn nhập sai mật khẩu quá 5 lần, tài khoản sẽ bị khóa tạm thời trong 15 phút.
                        </p>
                    </div>
                </div>

                {/* Support Contact */}
                <div className="mt-6 text-center text-sm text-gray-600">
                    <p>
                        Cần hỗ trợ?{' '}
                        <a href="tel:1900xxxx" className="text-blue-600 hover:text-blue-700 font-medium">
                            Liên hệ phòng xét nghiệm
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
