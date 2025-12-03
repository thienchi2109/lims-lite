'use client'

import { useEffect, useState } from 'react'
import { getSampleTests } from '@/app/actions/samples'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Loader2, FlaskConical, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AssignedTestsPanelProps {
    sampleId: string | null
    onAssignTests: () => void
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

export function AssignedTestsPanel({ sampleId, onAssignTests }: AssignedTestsPanelProps) {
    const [tests, setTests] = useState<TestResult[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (sampleId) {
            const fetchTests = async () => {
                setLoading(true)
                const { data, error } = await getSampleTests(sampleId)
                if (data) {
                    setTests(data as any)
                }
                setLoading(false)
            }
            fetchTests()
        } else {
            setTests([])
        }
    }, [sampleId])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
            case 'entered': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
            case 'approved': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
            case 'rejected': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
            default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
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

    if (!sampleId) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                <FlaskConical className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Chọn một mẫu để xem xét nghiệm</p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-950 border rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <FlaskConical className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Danh sách xét nghiệm
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {tests.length} chỉ tiêu được chỉ định
                        </p>
                    </div>
                </div>
                <Button size="sm" onClick={onAssignTests} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Chỉ định
                </Button>
            </div>

            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10">
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Chỉ tiêu</TableHead>
                            <TableHead>Phương pháp</TableHead>
                            <TableHead>Kết quả</TableHead>
                            <TableHead className="w-[140px]">Trạng thái</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Đang tải dữ liệu...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : tests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    Chưa có xét nghiệm nào được chỉ định
                                </TableCell>
                            </TableRow>
                        ) : (
                            tests.map((test) => (
                                <TableRow key={test.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                    <TableCell className="font-medium">
                                        {test.assay.name}
                                        {test.assay.units && (
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                ({test.assay.units})
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {test.assay.method?.name || '-'}
                                    </TableCell>
                                    <TableCell>
                                        {test.value ? (
                                            <span className="font-mono font-medium">
                                                {test.value}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground italic text-xs">
                                                --
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn("font-normal whitespace-nowrap", getStatusColor(test.status))}
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
        </div>
    )
}
