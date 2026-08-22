'use client'

import { useCallback, useRef } from 'react'
import { findClientByIdentityQrClient } from '@/lib/api-client'
import type { Client, CreateClient } from '@/types'
import type { ParsedClientIdentityQr } from '@/lib/qr/parse-client-identity-qr'

interface UseClientIdentityScanOptions {
    onDraft: (draft: Partial<CreateClient>) => void
    onExistingClient: (client: Client) => void
    onLookupError?: (error: unknown) => void
}

export function useClientIdentityScan({
    onDraft,
    onExistingClient,
    onLookupError,
}: UseClientIdentityScanOptions) {
    const scanGenerationRef = useRef(0)

    const handleIdentityScan = useCallback(async (
        parsed: ParsedClientIdentityQr,
    ) => {
        const scanGeneration = ++scanGenerationRef.current
        const { idCardNum, name, dateOfBirth, gender, address } = parsed

        onDraft({
            name,
            id_card_num: idCardNum || '',
            date_of_birth: dateOfBirth,
            gender,
            phone: '',
            address: address || '',
        })

        try {
            const result = await findClientByIdentityQrClient({
                governmentIdentityValue: idCardNum,
                name,
                dateOfBirth,
            })
            if (
                scanGeneration === scanGenerationRef.current
                && result.data
            ) {
                onExistingClient(result.data)
            }
        } catch (error) {
            if (scanGeneration === scanGenerationRef.current) {
                onLookupError?.(error)
            }
        }
    }, [onDraft, onExistingClient, onLookupError])

    const invalidateIdentityScan = useCallback(() => {
        scanGenerationRef.current += 1
    }, [])

    return {
        handleIdentityScan,
        invalidateIdentityScan,
    }
}
