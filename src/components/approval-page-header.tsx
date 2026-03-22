'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { WalkthroughTrigger } from '@/components/walkthrough'
import { Button } from '@/components/ui/button'

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
                        Quay lại<span className="hidden sm:inline">{' '}Bảng điều khiển</span>
                    </Button>
                </Link>
                <span className="hidden sm:inline-flex">
                    <WalkthroughTrigger tourId="approval" autoShowTooltip={false} />
                </span>
            </div>
            <div className="whitespace-nowrap text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                {samplesCount} mẫu {tab === 'review' ? 'chờ duyệt' : 'đã hoàn thành'}
            </div>
        </div>
    )
}
