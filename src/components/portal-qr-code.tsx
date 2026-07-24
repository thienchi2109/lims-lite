/**
 * Portal QR Code Component
 *
 * Generates QR codes for the CoA Public Portal
 * Can be used for printing, displaying, or embedding in reports
 */

'use client'

import { useState, useSyncExternalStore } from 'react'
import { FileText, Download, Printer, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { openDetachedHtmlDocument } from '@/lib/detached-html-document'
import { toast } from 'sonner'

interface PortalQRCodeProps {
    size?: number
    showInstructions?: boolean
    variant?: 'card' | 'inline'
}

const subscribeToPortalUrl = () => () => undefined

function getPortalUrlSnapshot() {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL
    if (configuredUrl) return `${configuredUrl}/coa/access`
    if (typeof window === 'undefined') return ''

    return `${window.location.protocol}//${window.location.host}/coa/access`
}

function getServerPortalUrlSnapshot() {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL
    return configuredUrl ? `${configuredUrl}/coa/access` : ''
}

export function PortalQRCode({
    size = 300,
    showInstructions = true,
    variant = 'card'
}: PortalQRCodeProps) {
    const [copied, setCopied] = useState(false)
    const portalUrl = useSyncExternalStore(
        subscribeToPortalUrl,
        getPortalUrlSnapshot,
        getServerPortalUrlSnapshot
    )

    // Generate QR code URL using QR Server API
    const qrCodeUrl = portalUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(portalUrl)}&margin=10`
        : ''

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(portalUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy URL:', err)
        }
    }

    const handleDownloadQR = () => {
        if (!qrCodeUrl) return

        const link = document.createElement('a')
        link.href = qrCodeUrl
        link.download = 'coa-portal-qr-code.png'
        link.click()
    }

    const handlePrint = () => {
        if (!qrCodeUrl) return

        openDetachedHtmlDocument(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>QR Code - Cổng Tra Cứu Giấy Chứng Nhận</title>
                    <style>
                        @page { size: A4; margin: 20mm; }
                        body {
                            font-family: 'Times New Roman', serif;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            margin: 0;
                            padding: 20px;
                        }
                        .container {
                            text-align: center;
                            border: 2px solid #0891B2;
                            padding: 40px;
                            border-radius: 12px;
                            max-width: 600px;
                        }
                        h1 {
                            color: #0F172A;
                            font-size: 28px;
                            margin-bottom: 10px;
                        }
                        h2 {
                            color: #0891B2;
                            font-size: 22px;
                            margin-bottom: 30px;
                            font-weight: normal;
                        }
                        .qr-code {
                            margin: 30px auto;
                            border: 8px solid #ECFEFF;
                            border-radius: 8px;
                        }
                        .instructions {
                            margin-top: 30px;
                            text-align: left;
                            background: #F0F9FF;
                            padding: 20px;
                            border-radius: 8px;
                            border-left: 4px solid #0891B2;
                        }
                        .instructions h3 {
                            color: #0891B2;
                            font-size: 18px;
                            margin-bottom: 15px;
                        }
                        .instructions ol {
                            margin: 0;
                            padding-left: 25px;
                        }
                        .instructions li {
                            margin-bottom: 10px;
                            line-height: 1.6;
                        }
                        .url {
                            margin-top: 20px;
                            padding: 15px;
                            background: #ECFEFF;
                            border-radius: 6px;
                            font-family: monospace;
                            font-size: 14px;
                            word-break: break-all;
                            color: #0369A1;
                        }
                        .footer {
                            margin-top: 40px;
                            font-size: 14px;
                            color: #64748B;
                            font-style: italic;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>TRUNG TÂM KIỂM SOÁT BỆNH TẬT (CDC)</h1>
                        <h2>Cổng Tra Cứu Giấy Chứng Nhận Xét Nghiệm</h2>

                        <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" />

                        <div class="instructions">
                            <h3>Hướng Dẫn Truy Cập Kết Quả Xét Nghiệm:</h3>
                            <ol>
                                <li><strong>Quét mã QR</strong> bằng camera điện thoại</li>
                                <li><strong>Nhập số điện thoại</strong> bạn đã cung cấp khi gửi mẫu</li>
                                <li><strong>Xem và tải về</strong> giấy chứng nhận kết quả</li>
                            </ol>
                        </div>

                        <div class="url">
                            <strong>Hoặc truy cập trực tiếp:</strong><br/>
                            ${portalUrl}
                        </div>

                        <div class="footer">
                            Hệ thống CDC-LIMS - Tuân thủ tiêu chuẩn 21 CFR Part 11
                        </div>
                    </div>
                </body>
                </html>
            `, {
                autoPrint: true,
                onBlocked: () => toast.error('Trình duyệt đã chặn cửa sổ in'),
                onFailed: () => toast.error('Không thể mở tài liệu in'),
            })
    }

    if (variant === 'inline') {
        return (
            <div className="flex flex-col items-center gap-4">
                {qrCodeUrl && (
                    <img
                        src={qrCodeUrl}
                        alt="QR Code - Cổng tra cứu CoA"
                        className="border-4 border-cyan-100 rounded-lg shadow-md"
                    />
                )}
                {showInstructions && (
                    <div className="text-center text-sm text-slate-600 max-w-xs">
                        <p className="font-medium mb-2">Quét mã QR để truy cập</p>
                        <p className="text-xs">Cổng tra cứu giấy chứng nhận xét nghiệm</p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <Card className="border-cyan-200">
            <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-cyan-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-slate-900">QR Code Cổng Tra Cứu</CardTitle>
                        <CardDescription>Chia sẻ với khách hàng để truy cập kết quả</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-6">
                    {/* QR Code Display */}
                    <div className="flex justify-center">
                        {qrCodeUrl ? (
                            <div className="relative">
                                <img
                                    src={qrCodeUrl}
                                    alt="QR Code - Cổng tra cứu CoA"
                                    className="border-8 border-cyan-50 rounded-xl shadow-lg"
                                />
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-medium px-4 py-1 rounded-full shadow-md">
                                    Quét để truy cập
                                </div>
                            </div>
                        ) : (
                            <div className="w-[300px] h-[300px] bg-slate-100 rounded-xl flex items-center justify-center">
                                <p className="text-slate-400">Đang tải...</p>
                            </div>
                        )}
                    </div>

                    {/* URL Display */}
                    {portalUrl && (
                        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                            <p className="text-xs font-medium text-cyan-900 mb-2">Link trực tiếp:</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm text-cyan-700 bg-white px-3 py-2 rounded border border-cyan-200 overflow-x-auto">
                                    {portalUrl}
                                </code>
                                <Button
                                    onClick={handleCopyUrl}
                                    size="sm"
                                    variant="outline"
                                    className="flex-shrink-0 border-cyan-300 hover:bg-cyan-100"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4 mr-1 text-green-600" />
                                            Đã copy
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4 mr-1" />
                                            Copy
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    {showInstructions && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h4 className="font-semibold text-slate-900 mb-3">Hướng dẫn sử dụng:</h4>
                            <ol className="space-y-2 text-sm text-slate-700">
                                <li className="flex gap-2">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-semibold">1</span>
                                    <span>In hoặc tải về mã QR này</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-semibold">2</span>
                                    <span>Đưa cho khách hàng khi nhận mẫu xét nghiệm</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center font-semibold">3</span>
                                    <span>Khách hàng quét mã QR và nhập số điện thoại để truy cập kết quả</span>
                                </li>
                            </ol>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={handlePrint}
                            className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            In mã QR
                        </Button>
                        <Button
                            onClick={handleDownloadQR}
                            variant="outline"
                            className="flex-1 border-cyan-300 hover:bg-cyan-50"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Tải về
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
