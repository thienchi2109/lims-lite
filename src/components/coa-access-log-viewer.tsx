'use client'

import { useQuery } from '@tanstack/react-query'
import { getCoAAccessLogs } from '@/app/actions/coa'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, Monitor } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface CoAAccessLogViewerProps {
    sampleId: string
}

export function CoAAccessLogViewer({ sampleId }: CoAAccessLogViewerProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['coa-access-logs', sampleId],
        queryFn: async () => {
            const result = await getCoAAccessLogs(sampleId)
            if (result.error) throw new Error(result.error)
            return result.data
        },
        refetchInterval: 30000, // Auto-refresh every 30 seconds
    })

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Lịch sử truy cập CoA</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-red-500">
                        Lỗi: {error instanceof Error ? error.message : 'Unknown error'}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Lịch sử truy cập CoA
                </CardTitle>
                <CardDescription>
                    Nhật ký các lần khách hàng truy cập và tải xuống giấy chứng nhận
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 animate-spin" />
                        Đang tải...
                    </div>
                ) : !data || data.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        Chưa có lịch sử truy cập nào.
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Thời gian</TableHead>
                                    <TableHead>Khách hàng</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Lý do lỗi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-mono text-xs">
                                            {new Date(log.accessed_at).toLocaleString('vi-VN')}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {log.client_name}
                                        </TableCell>
                                        <TableCell>
                                            {log.success ? (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                                                >
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Thành công
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 bg-red-50 text-red-700 border-red-200"
                                                >
                                                    <XCircle className="h-3 w-3" />
                                                    Thất bại
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {log.ip_address || 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {log.failure_reason || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
