'use client'

// Feature-local request ownership and UUID-only recovery; all authorization stays on the server.
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { confirmAccessionClient, fetchAccessionConfirmationStatusClient, fetchAccessionReceiptSamplesClient } from '@/lib/api-client'
import { accessionBatchIdSchema, type AccessionConfirmationStatus, type AccessionReceiptSamples } from '@/lib/accession-preview/http-contract'
import { sampleKeys, searchKeys } from '@/types/query-keys'

const recoveryKey = 'lims-accession-import-batch'
type Outcome = AccessionConfirmationStatus | { state: 'denied'; batchId: string }
export type ImportConfirmation = { outcome: Outcome; samples?: AccessionReceiptSamples; idsError?: boolean }
function denied(error: unknown) {
    return error instanceof Error && /^(Bạn không có quyền truy cập lần nhập này\.|Phiên đăng nhập)/.test(error.message)
}

export function useAccessionImport() {
    const [confirmation, setConfirmation] = useState<ImportConfirmation | null>(null)
    const [locator, setLocator] = useState<string | null>(null)
    const [confirming, setConfirming] = useState(false)
    const [checking, setChecking] = useState(false)
    const attempt = useRef<object | null>(null)
    const live = useRef(true)
    const queryClient = useQueryClient()
    useEffect(() => {
        live.current = true
        return () => { live.current = false; attempt.current = null }
    }, [])

    function rememberBatch(batchId: string) {
        if (!live.current) return
        const parsed = accessionBatchIdSchema.safeParse(batchId)
        if (!parsed.success) return
        setLocator(parsed.data)
        try { sessionStorage.setItem(recoveryKey, parsed.data) } catch { /* In-memory guard remains authoritative. */ }
    }

    function clearLocator() {
        if (!live.current) return
        setLocator(null)
        try { sessionStorage.removeItem(recoveryKey) } catch { /* No file or response is ever stored. */ }
    }

    function restore() {
        if (confirmation) return
        let saved = locator
        if (!saved) {
            try {
                const stored = sessionStorage.getItem(recoveryKey)
                const parsed = accessionBatchIdSchema.safeParse(stored)
                if (parsed.success) saved = parsed.data
                else if (stored !== null) sessionStorage.removeItem(recoveryKey)
            } catch { /* Storage is optional; do not clear an existing in-memory guard. */ }
        }
        if (saved) {
            setLocator(saved)
            setConfirmation({ outcome: { state: 'unknown', batchId: saved } })
        }
    }

    function deny(batchId: string, token: object) {
        if (!live.current || attempt.current !== token) return
        clearLocator()
        attempt.current = null
        setConfirmation({ outcome: { state: 'denied', batchId } })
    }

    async function receive(outcome: Outcome, token: object) {
        // Query caches outlive this view; known committed success still refreshes them after unmount.
        if (outcome.state === 'succeeded') {
            void queryClient.invalidateQueries({ queryKey: sampleKeys.all }).catch(() => {})
            void queryClient.invalidateQueries({ queryKey: searchKeys.all }).catch(() => {})
        }
        if (!live.current || attempt.current !== token) return
        setConfirming(false); setChecking(false)
        const batchId = outcome.state === 'succeeded' ? outcome.receipt.batch_id : outcome.batchId
        if (outcome.state === 'denied') { deny(batchId, token); return }
        rememberBatch(batchId)
        setConfirmation({ outcome })
        if (outcome.state !== 'succeeded') {
            attempt.current = null
            return
        }
        try {
            const samples = await fetchAccessionReceiptSamplesClient(batchId)
            if (live.current && attempt.current === token) setConfirmation({ outcome, samples })
        } catch (error) {
            if (denied(error)) deny(batchId, token)
            else if (live.current && attempt.current === token) setConfirmation({ outcome, idsError: true })
        }
    }

    async function confirm(batchId: string, file: File) {
        if (!live.current || attempt.current) return
        const token = {}; attempt.current = token
        rememberBatch(batchId)
        setConfirming(true)
        setConfirmation({ outcome: { state: 'processing', batchId } })
        let outcome: Outcome
        try { outcome = await confirmAccessionClient(batchId, file, true) }
        catch (error) { outcome = { state: denied(error) ? 'denied' : 'unknown', batchId } }
        await receive(outcome, token)
    }

    async function lookup() {
        if (!live.current || !locator || confirming || checking) return
        const sameSuccess = confirmation?.outcome.state === 'succeeded' && confirmation.outcome.receipt.batch_id === locator
        const token = sameSuccess && attempt.current ? attempt.current : {}
        attempt.current = token
        setChecking(true)
        let outcome: Outcome
        try { outcome = await fetchAccessionConfirmationStatusClient(locator) }
        catch (error) { outcome = { state: denied(error) ? 'denied' : 'unknown', batchId: locator } }
        if (outcome.state === 'unknown' && confirmation?.outcome.state === 'succeeded') {
            if (live.current && attempt.current === token) setChecking(false)
            return
        }
        await receive(outcome, token)
    }

    async function retryOutcome(outcome: AccessionConfirmationStatus) {
        if (!live.current) return
        const token = {}; attempt.current = token
        await receive(outcome, token)
    }

    function startPreview() { attempt.current = null; setConfirmation(null) }
    function startNewImport() { startPreview(); clearLocator() }
    return { confirmation, locator, confirming, checking, confirm, lookup, retryOutcome, rememberBatch, restore, startPreview, startNewImport }
}
