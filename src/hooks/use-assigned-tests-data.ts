'use client'

/**
 * useAssignedTestsData Hook
 *
 * Manages data fetching for the AssignedTestsPanel: sample results,
 * sample status, CoA report status, and QC assay statuses.
 * Includes race-condition guard via currentSampleIdRef to discard
 * stale responses when sampleId changes rapidly.
 */

import { useEffect, useState, useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { fetchSampleResultsClient } from '@/lib/api-client'
import { getCoAStatus } from '@/app/actions/coa'
import { getQCStatusForAssays, type AssayQCStatus } from '@/app/actions/qc-status'
import type { ResultWithAssay, SampleStatus, CoAReportStatus } from '@/types'

export interface UseAssignedTestsDataReturn {
    results: ResultWithAssay[]
    loading: boolean
    error: string | null
    sampleStatus: SampleStatus | null
    qcStatuses: Record<string, AssayQCStatus>
    coaStatus: CoAReportStatus | null
    setCoaStatus: Dispatch<SetStateAction<CoAReportStatus | null>>
    fetchTests: () => Promise<void>
}

export function useAssignedTestsData(sampleId: string): UseAssignedTestsDataReturn {
    const [results, setResults] = useState<ResultWithAssay[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sampleStatus, setSampleStatus] = useState<SampleStatus | null>(null)
    const [coaStatus, setCoaStatus] = useState<CoAReportStatus | null>(null)
    const [qcStatuses, setQcStatuses] = useState<Record<string, AssayQCStatus>>({})

    // Ref to guard stale callbacks
    const currentSampleIdRef = useRef(sampleId)
    currentSampleIdRef.current = sampleId

    const fetchTests = useCallback(async () => {
        const fetchingSampleId = sampleId
        try {
            setLoading(true)
            setError(null)
            const { data, error: fetchError } = await fetchSampleResultsClient(sampleId)
            // Discard if sampleId changed while this callback was in-flight
            if (currentSampleIdRef.current !== fetchingSampleId) return
            if (fetchError) {
                setError(fetchError)
            } else if (data) {
                setResults(data)
                if (data.length > 0 && data[0].sample_status) {
                    setSampleStatus(data[0].sample_status as SampleStatus)
                }
            }
        } catch (err) {
            if (currentSampleIdRef.current !== fetchingSampleId) return
            setError('Failed to load assigned tests')
            console.error(err)
        } finally {
            if (currentSampleIdRef.current === fetchingSampleId) setLoading(false)
        }
    }, [sampleId])

    // Auto-fetch on sampleId change
    useEffect(() => {
        fetchTests()
    }, [fetchTests])

    // Fetch CoA status when sample is completed
    useEffect(() => {
        async function fetchCoA() {
            if (sampleStatus === 'completed') {
                const result = await getCoAStatus(sampleId)
                if (result.status) {
                    setCoaStatus(result.status)
                }
            }
        }
        fetchCoA()
    }, [sampleId, sampleStatus])

    // Fetch QC status for all assays when results change
    useEffect(() => {
        async function fetchQCStatus() {
            if (results.length === 0) return
            const assayIds = [...new Set(results.map(r => r.assay_id))]
            const qcResult = await getQCStatusForAssays(assayIds)
            if ('error' in qcResult) {
                console.error('Failed to fetch QC status:', qcResult.error)
                return
            }
            setQcStatuses(qcResult)
        }
        fetchQCStatus()
    }, [results])

    return {
        results,
        loading,
        error,
        sampleStatus,
        qcStatuses,
        coaStatus,
        setCoaStatus,
        fetchTests,
    }
}
