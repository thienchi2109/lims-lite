'use client'

/**
 * useCoaActions Hook
 *
 * Manages CoA (Certificate of Analysis) generation state and handler.
 * Extracted from AssignedTestsPanel for single-responsibility.
 */

import { useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { regenerateCoAClient } from '@/lib/api-client'
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
    const [activeGeneration, setActiveGeneration] = useState<{
        requestId: number
        sampleId: string
    } | null>(null)
    const currentSampleIdRef = useRef(sampleId)
    const latestGenerationIdRef = useRef(0)
    currentSampleIdRef.current = sampleId
    const isGeneratingCoA = activeGeneration?.sampleId === sampleId

    const handleGenerateCoA = useCallback(async () => {
        const generatingSampleId = sampleId
        const requestId = latestGenerationIdRef.current + 1
        latestGenerationIdRef.current = requestId
        setActiveGeneration({ sampleId: generatingSampleId, requestId })

        try {
            const result = await regenerateCoAClient(generatingSampleId)
            if (
                currentSampleIdRef.current !== generatingSampleId ||
                latestGenerationIdRef.current !== requestId
            ) {
                return
            }

            if (result.success) {
                toast.success('Đã tạo CoA thành công')
                setCoaStatus('ready')
            } else {
                toast.error(`Lỗi khi tạo CoA: ${result.error}`)
                setCoaStatus('failed')
            }
        } catch (err) {
            if (
                currentSampleIdRef.current !== generatingSampleId ||
                latestGenerationIdRef.current !== requestId
            ) {
                return
            }

            const message =
                err instanceof Error ? err.message : 'Có lỗi không mong đợi khi tạo CoA'
            toast.error(`Lỗi khi tạo CoA: ${message}`)
            setCoaStatus('failed')
            console.error(err)
        } finally {
            setActiveGeneration((current) =>
                current && current.requestId === requestId ? null : current
            )
        }
    }, [sampleId, setCoaStatus])

    return { isGeneratingCoA, handleGenerateCoA }
}
