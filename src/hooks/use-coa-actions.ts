'use client'

/**
 * useCoaActions Hook
 *
 * Manages CoA (Certificate of Analysis) generation state and handler.
 * Extracted from AssignedTestsPanel for single-responsibility.
 */

import { useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import { regenerateCoA } from '@/app/actions/coa'
import { toast } from 'sonner'
import type { CoAReportStatus } from '@/types'

export interface UseCoaActionsReturn {
    isGeneratingCoA: boolean
    handleGenerateCoA: () => Promise<void>
}

export function useCoaActions(
    sampleId: string,
    setCoaStatus: Dispatch<SetStateAction<CoAReportStatus | null>>,
): UseCoaActionsReturn {
    const [isGeneratingCoA, setIsGeneratingCoA] = useState(false)

    const handleGenerateCoA = useCallback(async () => {
        setIsGeneratingCoA(true)
        try {
            const result = await regenerateCoA(sampleId)
            if (result.success) {
                toast.success('Đã tạo CoA thành công')
                setCoaStatus('ready')
            } else {
                toast.error(`Lỗi khi tạo CoA: ${result.error}`)
                setCoaStatus('failed')
            }
        } catch (err) {
            toast.error('Có lỗi không mong đợi khi tạo CoA')
            console.error(err)
        } finally {
            setIsGeneratingCoA(false)
        }
    }, [sampleId, setCoaStatus])

    return { isGeneratingCoA, handleGenerateCoA }
}
