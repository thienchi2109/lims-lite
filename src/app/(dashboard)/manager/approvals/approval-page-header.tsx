'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { WalkthroughTrigger } from '@/components/walkthrough'

interface ApprovalPageHeaderProps {
    samplesCount: number
    tab: 'review' | 'completed'
}

export function ApprovalPageHeader({ samplesCount, tab }: ApprovalPageHeaderProps) {
    return (
        <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
                <Link href="/manager">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Quay lại Bảng điều khiển
                    </Button>
                </Link>
                <WalkthroughTrigger tourId="approval" />
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {samplesCount} mẫu {tab === 'review' ? 'đang chờ phê duyệt' : 'đã hoàn thành'}
            </div>
        </div>
    )
}
