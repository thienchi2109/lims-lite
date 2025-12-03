'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { getSampleTests } from '@/app/actions/samples'
import {
    Loader2,
    TestTube2,
    FlaskConical,
    Calendar,
    User,
    Hash,
    FileText,
    Building2,
    Clock
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from '@/lib/utils'

interface SampleDetailDialogProps {
    sample: SampleWithUser
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface TestResult {
    id: string
    status: string
    value: string | null
    assay: {
        id: string
        name: string
        units: string | null
        method: {
            id: string
            name: string
        } | null
    }
}

export function SampleDetailDialog({
    sample,
    open,
    onOpenChange,
}: SampleDetailDialogProps) {
    const [tests, setTests] = useState<TestResult[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && sample.id) {
            const fetchTests = async () => {
                setLoading(true)
                const { data, error } = await getSampleTests(sample.id)
                if (data) {
                    setTests(data as any)
                }
                setLoading(false)
            }
            fetchTests()
        } else {
            setTests([])
        }
    }, [open, sample.id])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
            case 'entered': return 'bg-blue-100 text-blue-800 border-blue-200'
            case 'approved': return 'bg-green-100 text-green-800 border-green-200'
            case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
            default: return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'Chờ kết quả'
            case 'entered': return 'Đã nhập KQ'
            case 'approved': return 'Đã duyệt'
            case 'rejected': return 'Từ chối'
            default: return status
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden gap-0">
                <DialogHeader className="px-6 py-4 bg-muted/40 border-b">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <TestTube2 className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Chi tiết mẫu</DialogTitle>
                            <DialogDescription>
                                Thông tin đầy đủ và các xét nghiệm được chỉ định
                            </DialogDescription>
                        </div>
                        <div className="ml-auto">
                            <SampleStatusBadge status={sample.status} />
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[80vh]">
                    <div className="p-6 space-y-8">
                        {/* Basic Info Section */}
                        <section>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Thông tin chung
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/20 rounded-lg border">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Hash className="h-3.5 w-3.5" />
                                        Mã mẫu
                                    </div>
                                    <div className="font-mono font-medium text-base">{sample.sample_id}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Building2 className="h-3.5 w-3.5" />
                                        Khách hàng
                                    </div>
                                    <div className="font-medium">{sample.client_name || 'N/A'}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        Ngày nhận
                                    </div>
                                    <div>{formatDate(sample.received_at)}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User className="h-3.5 w-3.5" />
                                        Người nhận
                                    </div>
                                    <div>{sample.received_by_name || 'N/A'}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-3.5 w-3.5" />
                                        Cập nhật cuối
                                    </div>
                                    <div className="text-sm">{formatDate(sample.updated_at)}</div>
                                </div>
                            </div>
                        </section>

                        <Separator />

                        {/* Tests Section */}
                        <section>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                                <FlaskConical className="h-4 w-4" />
                                Danh sách xét nghiệm
                            </h3>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Chỉ tiêu</TableHead>
                                            <TableHead>Phương pháp</TableHead>
                                            <TableHead>Kết quả</TableHead>
                                            <TableHead className="w-[140px]">Trạng thái</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center">
                                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Đang tải dữ liệu...
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : tests.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                    Chưa có xét nghiệm nào được chỉ định
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            tests.map((test) => (
                                                <TableRow key={test.id}>
                                                    <TableCell className="font-medium">
                                                        {test.assay.name}
                                                        {test.assay.units && (
                                                            <span className="ml-1 text-xs text-muted-foreground">
                                                                ({test.assay.units})
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {test.assay.method?.name || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {test.value ? (
                                                            <span className="font-mono font-medium">
                                                                {test.value}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground italic text-sm">
                                                                Chưa có KQ
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn("font-normal", getStatusColor(test.status))}
                                                        >
                                                            {getStatusLabel(test.status)}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
