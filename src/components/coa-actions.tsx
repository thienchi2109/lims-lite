'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, RefreshCcw, Download, AlertCircle } from 'lucide-react'
import { regenerateCoA } from '@/app/actions/coa'
import { useRouter } from 'next/navigation'
import { CoAStatusBadge } from '@/components/coa-status-badge'
import type { CoAReportStatus } from '@/types'

interface CoAActionsProps {
    sampleId: string
    sampleStatus: string
    coaReport?: {
        id: string
        status: CoAReportStatus
        error_message: string | null
        file_path: string
        generated_at: string
    } | null
}

export function CoAActions({ sampleId, sampleStatus, coaReport }: CoAActionsProps) {
    const [isRegenerating, setIsRegenerating] = useState(false)
    const router = useRouter()

    // Only show for completed samples
    if (sampleStatus !== 'completed') {
        return null
    }

    const handleRegenerate = async () => {
        setIsRegenerating(true)
        try {
            const result = await regenerateCoA(sampleId)
            if (result.success) {
                router.refresh()
            } else {
                alert(`Lỗi khi tạo lại CoA: ${result.error}`)
            }
        } catch (error) {
            alert(`Lỗi không mong đợi: ${error}`)
        } finally {
            setIsRegenerating(false)
        }
    }

    const handleDownload = () => {
        // Internal staff download (direct Storage access)
        // TODO: Implement direct download via signed URL
        alert('Chức năng tải xuống đang được phát triển')
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Giấy chứng nhận phân tích (CoA)
                        </CardTitle>
                        <CardDescription>
                            Quản lý và tải xuống giấy chứng nhận phân tích
                        </CardDescription>
                    </div>
                    {coaReport && <CoAStatusBadge status={coaReport.status} />}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Error Alert */}
                {coaReport?.status === 'failed' && coaReport.error_message && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Lỗi tạo CoA:</strong> {coaReport.error_message}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Status Info */}
                <div className="text-sm text-muted-foreground">
                    {!coaReport && (
                        <p>CoA chưa được tạo. Nhấn nút bên dưới để tạo mới.</p>
                    )}
                    {coaReport?.status === 'pending' && (
                        <p>CoA đang được tạo. Vui lòng đợi...</p>
                    )}
                    {coaReport?.status === 'ready' && (
                        <p>
                            CoA đã sẵn sàng. Tạo lúc:{' '}
                            {new Date(coaReport.generated_at).toLocaleString('vi-VN')}
                        </p>
                    )}
                    {coaReport?.status === 'failed' && (
                        <p>Tạo CoA thất bại. Vui lòng thử lại.</p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                    {/* Regenerate Button - Show for failed or to create new */}
                    {(!coaReport || coaReport.status === 'failed') && (
                        <Button
                            onClick={handleRegenerate}
                            disabled={isRegenerating}
                            className="gap-2"
                            size="lg"
                        >
                            <RefreshCcw className={`h-5 w-5 ${isRegenerating ? 'animate-spin' : ''}`} />
                            {!coaReport ? 'Tạo CoA' : 'Tạo lại CoA'}
                        </Button>
                    )}

                    {/* Download Button - Show when ready */}
                    {coaReport?.status === 'ready' && (
                        <Button
                            onClick={handleDownload}
                            variant="outline"
                            className="gap-2"
                            size="lg"
                        >
                            <Download className="h-5 w-5" />
                            Tải xuống CoA
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
