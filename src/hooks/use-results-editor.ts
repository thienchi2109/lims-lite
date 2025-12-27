'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys } from '@/types/query-keys'
import { saveBatchResultsClient } from '@/lib/api-client'
import { validateNumericValue, validateTextValue } from '@/lib/utils-lims'
import type { ResultWithAssay } from '@/types'
import { toast } from 'sonner'

interface UseResultsEditorOptions {
    results: ResultWithAssay[]
    sampleId: string
    onSaveSuccess: () => void
}

interface UseResultsEditorReturn {
    resultValues: Record<string, string>
    validationErrors: Record<string, string>
    isSaving: boolean
    pendingCount: number
    handleValueChange: (resultId: string, value: string) => void
    handleSave: () => Promise<void>
    handleDiscard: () => void
    getDisplayValue: (result: ResultWithAssay) => string
    hasValidationErrors: boolean
}

async function validateResultValue(value: string, rules: Record<string, unknown>) {
    const normalizedRules = rules || {}
    if (
        normalizedRules.type === 'numeric' ||
        normalizedRules.min !== undefined ||
        normalizedRules.max !== undefined
    ) {
        return validateNumericValue(value, normalizedRules)
    }
    return validateTextValue(value, normalizedRules)
}

export function useResultsEditor({
    results,
    sampleId,
    onSaveSuccess,
}: UseResultsEditorOptions): UseResultsEditorReturn {
    const queryClient = useQueryClient()
    const [resultValues, setResultValues] = useState<Record<string, string>>({})
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [isSaving, setIsSaving] = useState(false)

    const pendingCount = Object.keys(resultValues).length
    const hasValidationErrors = Object.keys(validationErrors).length > 0

    const handleValueChange = useCallback(
        async (resultId: string, value: string) => {
            setResultValues((prev) => ({
                ...prev,
                [resultId]: value,
            }))

            const result = results.find((r) => r.id === resultId)
            if (result) {
                const rules = result.validation_rules || {}
                const error = await validateResultValue(value, rules)

                setValidationErrors((prev) => {
                    const next = { ...prev }
                    if (error) {
                        next[resultId] = error
                    } else {
                        delete next[resultId]
                    }
                    return next
                })
            }
        },
        [results]
    )

    const handleSave = useCallback(async () => {
        if (hasValidationErrors) {
            toast.error('Vui lòng sửa các lỗi trước khi lưu')
            return
        }

        setIsSaving(true)
        try {
            const updates = Object.entries(resultValues).map(([id, value]) => ({
                id,
                value,
            }))

            const result = await saveBatchResultsClient({ results: updates })

            if (result.error) {
                toast.error(result.error)
                if (result.validationErrors) {
                    const serverErrors: Record<string, string> = {}
                    result.validationErrors.forEach((err: { id: string; error: string }) => {
                        serverErrors[err.id] = err.error
                    })
                    setValidationErrors(serverErrors)
                }
            } else {
                toast.success('Đã lưu kết quả thành công')
                setResultValues({})
                setValidationErrors({})
                queryClient.invalidateQueries({ queryKey: sampleKeys.detail(sampleId) })
                onSaveSuccess()
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra khi lưu kết quả')
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }, [hasValidationErrors, resultValues, queryClient, sampleId, onSaveSuccess])

    const handleDiscard = useCallback(() => {
        setResultValues({})
        setValidationErrors({})
        toast.info('Đã hủy các thay đổi')
    }, [])

    const getDisplayValue = useCallback(
        (result: ResultWithAssay) => {
            return resultValues[result.id] ?? result.value ?? ''
        },
        [resultValues]
    )

    return {
        resultValues,
        validationErrors,
        isSaving,
        pendingCount,
        handleValueChange,
        handleSave,
        handleDiscard,
        getDisplayValue,
        hasValidationErrors,
    }
}
