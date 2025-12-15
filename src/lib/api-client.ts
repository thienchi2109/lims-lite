'use client'

import type {
    AssignTests,
    SampleListParams,
    UpdateSample,
    CreateSample,
    CreateSampleWithAssignments,
    SaveBatchResults,
    ApproveResults,
    CancelApproval,
    CreateUser,
    UpdateUser,
    RejectSample,
    DiscardSample,
    CreateClient,
} from '@/types'
import type { ClientActionName } from '@/lib/client-actions/types'

const ENDPOINT = '/api/client-actions'
const SESSION_EXPIRY_ENDPOINT = '/api/auth/session-expiry'

export type SessionTimeboxExpiryClientResponse =
    | {
          authenticated: true
          timebox_seconds: number
          expires_at: string | null
          expires_in_ms: number | null
          source: 'sessions.created_at' | 'auth.users.last_sign_in_at' | 'unknown'
      }
    | {
          authenticated: false
          error: string
          reason?: string
      }

async function callClientAction<T = any>(action: ClientActionName, payload?: unknown): Promise<T> {
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action, payload }),
    })

    if (response.status === 401) {
        // Handle session expiry
        console.error('Session expired or invalid, redirecting to login...')
        if (typeof window !== 'undefined') {
            window.location.href = '/login?reason=session_expired'
        }
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }

    if (!response.ok) {
        let errorMessage = 'Không thể kết nối đến máy chủ'
        try {
            const errorBody = await response.json()
            if (errorBody?.error) {
                errorMessage = errorBody.error
            }
        } catch {
            // ignore json parse error
        }
        throw new Error(errorMessage)
    }

    const data = await response.json()
    if (data && typeof data === 'object' && 'error' in data && (data as any).error) {
        // Double check if the error inside payload suggests auth failure
        const errorMsg = String((data as any).error).toLowerCase()
        if (errorMsg.includes('jws') || errorMsg.includes('signature') || errorMsg.includes('jwt')) {
            if (typeof window !== 'undefined') {
                window.location.href = '/login?error=SessionExpired'
            }
            throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.')
        }
        throw new Error(String((data as any).error))
    }

    return data as T
}

export function fetchSamplesClient(params: SampleListParams) {
    return callClientAction('getSamples', params)
}

export function fetchSamplesForApprovalCountClient() {
    return callClientAction<{ data: number }>('getSamplesForApprovalCount')
}

export function assignTestsClient(data: AssignTests) {
    return callClientAction('assignTests', data)
}

export function updateSampleClient(data: UpdateSample) {
    return callClientAction('updateSample', data)
}

export function createSampleClient(data: CreateSample) {
    return callClientAction('createSample', data)
}

export function accessionAndAssignTestsClient(data: CreateSampleWithAssignments) {
    return callClientAction('accessionAndAssignTests', data)
}

export function fetchSampleTestsClient(sampleId: string) {
    return callClientAction('getSampleTests', { sampleId })
}

export function fetchSampleResultsClient(sampleId: string) {
    return callClientAction('getResultsBySample', { sampleId })
}

export function saveBatchResultsClient(data: SaveBatchResults) {
    return callClientAction('saveBatchResults', data)
}

export function submitSampleForReviewClient(sampleId: string) {
    return callClientAction('submitSampleForReview', { sampleId })
}

export function fetchAssayDefinitionsClient(params?: Record<string, unknown>) {
    return callClientAction('getAssayDefinitions', params)
}

export function fetchMethodsClient() {
    return callClientAction('getMethods')
}

export function addMethodToAssayClient(payload: { assayId: string; methodId: string; isDefault: boolean; notes?: string }) {
    return callClientAction('addMethodToAssay', payload)
}

export function setDefaultMethodClient(assayId: string, methodId: string) {
    return callClientAction('setDefaultMethod', { assayId, methodId })
}

export function removeMethodFromAssayClient(assayMethodId: string) {
    return callClientAction('removeMethodFromAssay', { assayMethodId })
}

export function createAssayDefinitionClient(payload: { name: string; specialty_id?: string; methodId?: string; units?: string; validationRules?: Record<string, unknown> }) {
    return callClientAction('createAssayDefinition', payload)
}

export function updateAssayDefinitionClient(payload: { id: string; name: string; specialty_id?: string; units?: string; validationRules?: Record<string, unknown> }) {
    return callClientAction('updateAssayDefinition', payload)
}

export function deleteAssayDefinitionClient(id: string) {
    return callClientAction('deleteAssayDefinition', { id })
}

export function approveResultsClient(data: ApproveResults) {
    return callClientAction('approveResults', data)
}

export function cancelApprovalClient(data: CancelApproval) {
    return callClientAction('cancelApproval', data)
}

export function createUserClient(data: CreateUser) {
    return callClientAction('createUser', data)
}

export function updateUserClient(data: UpdateUser) {
    return callClientAction('updateUser', data)
}

export function deleteUserClient(userId: string) {
    return callClientAction('deleteUser', { userId })
}

export function rejectSampleClient(data: RejectSample) {
    return callClientAction('rejectSample', data)
}

export function discardSampleClient(data: DiscardSample) {
    return callClientAction('discardSample', data)
}

export function upsertClientClient(data: CreateClient) {
    return callClientAction('upsertClient', data)
}

export function findClientByIdentityClient(name: string, dateOfBirth: string) {
    return callClientAction('findClientByIdentity', { name, dateOfBirth })
}

export function getClientClient(id: string) {
    return callClientAction('getClient', { id })
}

export function fetchClientsClient(search?: string) {
    return callClientAction('getClients', search ? { search } : undefined)
}

export function updateClientClient(id: string, data: Partial<CreateClient>) {
    return callClientAction('updateClient', { id, data })
}

export async function logoutClient() {
    const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error('Không thể đăng xuất. Vui lòng thử lại.')
    }

    return response.json()
}

export async function getSessionTimeboxExpiryClient(
    options?: { signal?: AbortSignal }
): Promise<SessionTimeboxExpiryClientResponse> {
    const response = await fetch(SESSION_EXPIRY_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: options?.signal,
    })

    if (response.status === 401) {
        try {
            const body = (await response.json()) as any
            return {
                authenticated: false,
                error: String(body?.error || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'),
                reason: typeof body?.reason === 'string' ? body.reason : undefined,
            } satisfies SessionTimeboxExpiryClientResponse
        } catch {
            return {
                authenticated: false,
                error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
            } satisfies SessionTimeboxExpiryClientResponse
        }
    }

    if (!response.ok) {
        throw new Error('Không thể kiểm tra thời hạn phiên đăng nhập. Vui lòng thử lại.')
    }

    return (await response.json()) as SessionTimeboxExpiryClientResponse
}

// ============================================================================
// SIGNATURE MANAGEMENT (Phase 3.5)
// ============================================================================

/**
 * Upload manager signature file
 * Client-side wrapper that calls uploadManagerSignature server action
 */
export function uploadSignatureClient(formData: FormData) {
    return callClientAction('uploadManagerSignature', formData)
}

/**
 * Get active signature for current user
 * Returns signature metadata and path (not the actual image data)
 */
export function getActiveSignatureClient() {
    return callClientAction('getActiveSignature')
}

/**
 * Get signature history for current user
 * Returns all signatures ordered by upload date
 */
export function getSignatureHistoryClient() {
    return callClientAction('getSignatureHistory')
}

/**
 * Download signature as base64 data URI
 * Used for preview and display in UI
 */
export function downloadSignatureClient(signaturePath: string) {
    return callClientAction('downloadSignature', { signaturePath })
}
