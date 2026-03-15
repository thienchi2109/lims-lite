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
    const fetchRequestIdRef = useRef(0)
    const coaRequestIdRef = useRef(0)
    const qcRequestIdRef = useRef(0)

    const fetchTests = useCallback(async () => {
        const fetchingSampleId = sampleId
        const requestId = fetchRequestIdRef.current + 1
        fetchRequestIdRef.current = requestId
        try {
            setLoading(true)
            setError(null)
            const { data, error: fetchError } = await fetchSampleResultsClient(sampleId)
            // Discard if sampleId changed while this callback was in-flight
            if (
                currentSampleIdRef.current !== fetchingSampleId ||
                fetchRequestIdRef.current !== requestId
            ) {
                return
            }
            if (fetchError) {
                setResults([])
                setSampleStatus(null)
                setError(fetchError)
                return
            }

            const nextResults = data ?? []
            const nextSampleStatus =
                nextResults.length > 0 && nextResults[0].sample_status
                    ? (nextResults[0].sample_status as SampleStatus)
                    : null

            setResults(nextResults)
            setSampleStatus(nextSampleStatus)
        } catch (err) {
            if (
                currentSampleIdRef.current !== fetchingSampleId ||
                fetchRequestIdRef.current !== requestId
            ) {
                return
            }
            setResults([])
            setSampleStatus(null)
            setError('Failed to load assigned tests')
            console.error(err)
        } finally {
            if (
                currentSampleIdRef.current === fetchingSampleId &&
                fetchRequestIdRef.current === requestId
            ) {
                setLoading(false)
            }
        }
    }, [sampleId])

    // Auto-fetch on sampleId change
    useEffect(() => {
        setResults([])
        setSampleStatus(null)
        setCoaStatus(null)
        setQcStatuses({})
        setError(null)
        setLoading(true)
        void fetchTests()
    }, [sampleId, fetchTests])

    // Fetch CoA status when sample is completed
    useEffect(() => {
        const requestId = coaRequestIdRef.current + 1
        coaRequestIdRef.current = requestId

        if (sampleStatus !== 'completed') {
            setCoaStatus(null)
            return
        }

        async function fetchCoA() {
            try {
                const result = await getCoAStatus(sampleId)
                if (
                    currentSampleIdRef.current !== sampleId ||
                    coaRequestIdRef.current !== requestId
                ) {
                    return
                }

                setCoaStatus(result.status ?? null)
            } catch (err) {
                if (
                    currentSampleIdRef.current !== sampleId ||
                    coaRequestIdRef.current !== requestId
                ) {
                    return
                }

                setCoaStatus(null)
                console.error('Failed to fetch CoA status:', err)
            }
        }

        void fetchCoA()
    }, [sampleId, sampleStatus])

    // Fetch QC status for all assays when results change
    useEffect(() => {
        const requestId = qcRequestIdRef.current + 1
        qcRequestIdRef.current = requestId

        if (results.length === 0) {
            setQcStatuses({})
            return
        }

        async function fetchQCStatus() {
            const assayIds = [...new Set(results.map((result) => result.assay_id))]

            try {
                const qcResult = await getQCStatusForAssays(assayIds)
                if (
                    currentSampleIdRef.current !== sampleId ||
                    qcRequestIdRef.current !== requestId
                ) {
                    return
                }

                if ('error' in qcResult) {
                    console.error('Failed to fetch QC status:', qcResult.error)
                    setQcStatuses({})
                    return
                }

                setQcStatuses(qcResult)
            } catch (err) {
                if (
                    currentSampleIdRef.current !== sampleId ||
                    qcRequestIdRef.current !== requestId
                ) {
                    return
                }

                setQcStatuses({})
                console.error('Failed to fetch QC status:', err)
            }
        }

        void fetchQCStatus()
    }, [results, sampleId])

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
