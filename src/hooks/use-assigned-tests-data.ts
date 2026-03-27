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

const EMPTY_RESULTS: ResultWithAssay[] = []
const ENRICHMENT_ERROR_MESSAGE = 'Không thể tải trạng thái bổ sung'

export interface UseAssignedTestsDataReturn {
    results: ResultWithAssay[]
    loading: boolean
    error: string | null
    sampleStatus: SampleStatus | null
    qcStatuses: Record<string, AssayQCStatus>
    coaStatus: CoAReportStatus | null
    enrichmentLoading: boolean
    enrichmentError: string | null
    setCoaStatus: Dispatch<SetStateAction<CoAReportStatus | null>>
    fetchTests: () => Promise<void>
}

interface UseAssignedTestsDataOptions {
    initialResults?: ResultWithAssay[]
}

function deriveSampleStatus(results: ResultWithAssay[]): SampleStatus | null {
    return results.length > 0 && results[0].sample_status
        ? (results[0].sample_status as SampleStatus)
        : null
}

export function useAssignedTestsData(
    sampleId: string,
    options: UseAssignedTestsDataOptions = {},
): UseAssignedTestsDataReturn {
    const hasInitialResults = options.initialResults !== undefined
    const seededResults = options.initialResults ?? EMPTY_RESULTS
    const [results, setResults] = useState<ResultWithAssay[]>(seededResults)
    const [loading, setLoading] = useState(!hasInitialResults)
    const [error, setError] = useState<string | null>(null)
    const [sampleStatus, setSampleStatus] = useState<SampleStatus | null>(
        deriveSampleStatus(seededResults),
    )
    const [coaStatus, setCoaStatus] = useState<CoAReportStatus | null>(null)
    const [qcStatuses, setQcStatuses] = useState<Record<string, AssayQCStatus>>({})
    const [isCoALoading, setIsCoALoading] = useState(deriveSampleStatus(seededResults) === 'completed')
    const [isQCLoading, setIsQCLoading] = useState(seededResults.length > 0)
    const [coaError, setCoaError] = useState<string | null>(null)
    const [qcError, setQcError] = useState<string | null>(null)

    // Ref to guard stale callbacks
    const currentSampleIdRef = useRef(sampleId)
    currentSampleIdRef.current = sampleId
    const previousSampleIdRef = useRef(sampleId)
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
            const nextSampleStatus = deriveSampleStatus(nextResults)

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
        const sampleChanged = previousSampleIdRef.current !== sampleId
        previousSampleIdRef.current = sampleId

        setResults(seededResults)
        const nextSampleStatus = deriveSampleStatus(seededResults)
        setSampleStatus(nextSampleStatus)
        if (sampleChanged) {
            setCoaStatus(null)
            setQcStatuses({})
        }
        setError(null)
        setLoading(!hasInitialResults)
        setCoaError(null)
        setQcError(null)
        setIsCoALoading(nextSampleStatus === 'completed')
        setIsQCLoading(seededResults.length > 0)

        if (!hasInitialResults) {
            void fetchTests()
        }
    }, [sampleId, fetchTests, hasInitialResults, seededResults])

    // Fetch CoA status when sample is completed
    useEffect(() => {
        const requestId = coaRequestIdRef.current + 1
        coaRequestIdRef.current = requestId

        if (sampleStatus !== 'completed') {
            setCoaStatus(null)
            setCoaError(null)
            setIsCoALoading(false)
            return
        }

        async function fetchCoA() {
            setIsCoALoading(true)
            setCoaError(null)
            try {
                const result = await getCoAStatus(sampleId)
                if (
                    currentSampleIdRef.current !== sampleId ||
                    coaRequestIdRef.current !== requestId
                ) {
                    return
                }

                setCoaStatus(result.status ?? null)
                setCoaError(null)
            } catch (err) {
                if (
                    currentSampleIdRef.current !== sampleId ||
                    coaRequestIdRef.current !== requestId
                ) {
                    return
                }

                setCoaStatus(null)
                setCoaError(ENRICHMENT_ERROR_MESSAGE)
                console.error('Failed to fetch CoA status:', err)
            } finally {
                if (
                    currentSampleIdRef.current === sampleId &&
                    coaRequestIdRef.current === requestId
                ) {
                    setIsCoALoading(false)
                }
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
            setQcError(null)
            setIsQCLoading(false)
            return
        }

        async function fetchQCStatus() {
            const assayIds = [...new Set(results.map((result) => result.assay_id))]
            setIsQCLoading(true)
            setQcError(null)

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
                    setQcError(ENRICHMENT_ERROR_MESSAGE)
                    return
                }

                setQcStatuses(qcResult)
                setQcError(null)
            } catch (err) {
                if (
                    currentSampleIdRef.current !== sampleId ||
                    qcRequestIdRef.current !== requestId
                ) {
                    return
                }

                setQcStatuses({})
                setQcError(ENRICHMENT_ERROR_MESSAGE)
                console.error('Failed to fetch QC status:', err)
            } finally {
                if (
                    currentSampleIdRef.current === sampleId &&
                    qcRequestIdRef.current === requestId
                ) {
                    setIsQCLoading(false)
                }
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
        enrichmentLoading: isCoALoading || isQCLoading,
        enrichmentError: coaError ?? qcError,
        setCoaStatus,
        fetchTests,
    }
}
