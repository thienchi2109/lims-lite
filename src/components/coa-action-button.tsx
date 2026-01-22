'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { regenerateCoA } from '@/app/actions/coa'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CoAReportStatus } from '@/types'

interface CoAActionButtonProps {
    sampleId: string
    coaStatus?: CoAReportStatus | null
}

/**
 * CoA generation action button with its own loading state.
 * Extracted from ApprovalQueueTable to fix React Rules of Hooks violation
 * (useState cannot be called inside a TanStack Table cell render function).
 */
export function CoAActionButton({ sampleId, coaStatus }: CoAActionButtonProps) {
    const router = useRouter()
    const [isGenerating, setIsGenerating] = useState(false)

    const handleGenerateCoA = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsGenerating(true)
        try {
            const result = await regenerateCoA(sampleId)
            if (result.success) {
                toast.success('Đã tạo CoA thành công')
                router.refresh()
            } else {
                toast.error(`Lỗi khi tạo CoA: ${result.error}`)
            }
        } catch (error) {
            toast.error('Có lỗi không mong đợi khi tạo CoA')
            console.error(error)
        } finally {
            setIsGenerating(false)
        }
    }

    const tooltipText = coaStatus === 'failed'
        ? 'Tạo lại CoA'
        : coaStatus === 'pending'
            ? 'Tạo lại CoA (đang chờ)'
            : 'Tạo CoA'

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleGenerateCoA}
                        disabled={isGenerating}
                        className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950 disabled:opacity-50"
                    >
                        <FileText className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
