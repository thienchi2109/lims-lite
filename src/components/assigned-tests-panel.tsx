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
import { Loader2, FlaskConical, Plus, TestTube2 } from 'lucide-react'
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
            case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
            case 'entered': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
            case 'approved': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
            case 'rejected': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
            default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
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
            <div className="px-4 py-3 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                        <TestTube2 className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Danh sách xét nghiệm
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {tests.length} chỉ tiêu
                        </p>
                    </div>
                </div>
                <Button size="sm" onClick={onAssignTests} className="gap-1 h-8 text-xs font-medium">
                    <Plus className="h-3.5 w-3.5" />
                    Chỉ định
                </Button>
            </div>

            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-900/50 z-10">
                        <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                            <TableHead className="text-xs font-medium uppercase tracking-wider text-slate-500 h-9">Chỉ tiêu</TableHead>
                            <TableHead className="text-xs font-medium uppercase tracking-wider text-slate-500 h-9">Phương pháp</TableHead>
                            <TableHead className="text-xs font-medium uppercase tracking-wider text-slate-500 h-9">Kết quả</TableHead>
                            <TableHead className="w-[120px] text-xs font-medium uppercase tracking-wider text-slate-500 h-9">Trạng thái</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Đang tải dữ liệu...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : tests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-sm">
                                    Chưa có xét nghiệm nào được chỉ định
                                </TableCell>
                            </TableRow>
                        ) : (
                            tests.map((test) => (
                                <TableRow key={test.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 border-slate-100 dark:border-slate-800">
                                    <TableCell className="font-medium text-sm py-3">
                                        {test.assay.name}
                                        {test.assay.units && (
                                            <span className="ml-1 text-xs text-muted-foreground font-normal">
                                                ({test.assay.units})
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs py-3">
                                        {test.assay.method?.name || '-'}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        {test.value ? (
                                            <span className="font-mono font-medium text-sm">
                                                {test.value}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 dark:text-slate-700 text-xs">
                                                --
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Badge
                                            variant="outline"
                                            className={cn("font-normal whitespace-nowrap text-[10px] px-2 py-0.5 h-auto", getStatusColor(test.status))}
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
