import { NextResponse } from 'next/server'
import {
    assignTests,
    updateSample,
    createSample,
    accessionAndAssignTests,
    getSampleTests,
    getSamples,
    getSamplesForApprovalCount,
    submitSampleForReview,
    rejectSample,
    discardSample,
} from '@/app/actions/samples'
import {
    getResultsBySample,
    saveBatchResults,
    approveResults,
    cancelApproval,
} from '@/app/actions/results'
import {
    getAssayDefinitions as fetchAssayDefinitions,
    getMethods,
    createAssayDefinition,
    updateAssayDefinition,
    deleteAssayDefinition,
} from '@/app/actions/assays'
import {
    addMethodToAssay,
    setDefaultMethod,
    removeMethodFromAssay,
} from '@/app/actions/assay-methods'
import { createUser, updateUser, deleteUser } from '@/app/actions/users'
import {
    upsertClient,
    findClientByIdentity,
    getClient,
    getClients,
    updateClient,
} from '@/app/actions/clients'
import {
    uploadManagerSignature,
    getActiveSignature,
    getSignatureHistory,
    downloadSignature,
} from '@/app/actions/signatures'
import {
    searchSamples,
    searchClients,
    searchAssays,
    searchResults,
    searchAuditLogs,
    globalSearch,
} from '@/app/actions/search'
import { generateCoA, regenerateCoA } from '@/app/actions/coa'
import { isIsoDateString } from '@/lib/iso-date'
import type { ClientActionName, ClientActionRequest } from '@/lib/client-actions/types'

interface ActionHandler {
    (payload?: any): Promise<any>
}

function isAllowedOrigin(request: Request) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const requestHost = new URL(request.url).host
    const headerHost = request.headers.get('host')
    const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL

    const allowedHosts = new Set<string>()
    allowedHosts.add(requestHost)
    if (headerHost) allowedHosts.add(headerHost)
    if (envSiteUrl) {
        try {
            allowedHosts.add(new URL(envSiteUrl).host)
        } catch {
            // ignore malformed SITE_URL
        }
    }

    const isHostAllowed = (value: string | null) => {
        if (!value) return false
        try {
            const host = new URL(value).host
            return allowedHosts.has(host)
        } catch {
            return allowedHosts.has(value)
        }
    }

    if (origin && !isHostAllowed(origin)) return false
    if (!origin && referer && !isHostAllowed(referer)) return false

    return true
}

function mapErrorToStatus(message: string) {
    const normalized = message.toLowerCase()
    // Map JWS/JWT errors to 401 so client can handle redirect
    if (normalized.includes('unauthorized') || normalized.includes('jws') || normalized.includes('signature') || normalized.includes('jwt')) return 401
    if (normalized.includes('forbidden')) return 403
    if (normalized.includes('not found')) return 404
    return 400
}

const actionHandlers: Record<ClientActionName, ActionHandler> = {
    getSamples: async (payload) => getSamples(payload),
    getSamplesForApprovalCount: async () => getSamplesForApprovalCount(),
    assignTests: async (payload) => assignTests(payload),
    updateSample: async (payload) => updateSample(payload),
    createSample: async (payload) => createSample(payload),
    accessionAndAssignTests: async (payload) => accessionAndAssignTests(payload),
    getSampleTests: async (payload) => {
        if (!payload?.sampleId) {
            return { error: 'Sample ID is required' }
        }
        return getSampleTests(payload.sampleId)
    },
    getResultsBySample: async (payload) => {
        if (!payload?.sampleId) {
            return { error: 'Sample ID is required' }
        }
        return getResultsBySample(payload.sampleId)
    },
    saveBatchResults: async (payload) => saveBatchResults(payload),
    submitSampleForReview: async (payload) => {
        if (!payload?.sampleId) {
            return { error: 'Sample ID is required' }
        }
        return submitSampleForReview(payload.sampleId)
    },
    getAssayDefinitions: async (payload) => fetchAssayDefinitions(payload),
    getMethods: async () => getMethods(),
    addMethodToAssay: async (payload) => {
        if (!payload?.assayId || !payload?.methodId) {
            return { error: 'assayId và methodId là bắt buộc' }
        }
        const formData = new FormData()
        formData.append('assay_id', payload.assayId)
        formData.append('method_id', payload.methodId)
        formData.append('is_default', String(!!payload.isDefault))
        if (payload.notes) {
            formData.append('notes', payload.notes)
        }
        return addMethodToAssay(formData)
    },
    setDefaultMethod: async (payload) => {
        if (!payload?.assayId || !payload?.methodId) {
            return { error: 'assayId và methodId là bắt buộc' }
        }
        return setDefaultMethod(payload.assayId, payload.methodId)
    },
    removeMethodFromAssay: async (payload) => {
        if (!payload?.assayMethodId) {
            return { error: 'assayMethodId là bắt buộc' }
        }
        return removeMethodFromAssay(payload.assayMethodId)
    },
    createAssayDefinition: async (payload) => {
        if (!payload?.name) {
            return { error: 'Tên chỉ tiêu là bắt buộc' }
        }
        const formData = new FormData()
        formData.append('name', payload.name)
        if (payload.specialty_id) {
            formData.append('specialty_id', payload.specialty_id)
        }
        if (payload.methodId) {
            formData.append('method_id', payload.methodId)
        }
        if (payload.units) {
            formData.append('units', payload.units)
        }
        if (payload.validationRules) {
            formData.append('validation_rules', JSON.stringify(payload.validationRules))
        }
        return createAssayDefinition(formData)
    },
    updateAssayDefinition: async (payload) => {
        if (!payload?.id || !payload?.name) {
            return { error: 'id và tên chỉ tiêu là bắt buộc' }
        }
        const formData = new FormData()
        formData.append('id', payload.id)
        formData.append('name', payload.name)
        if (payload.specialty_id) {
            formData.append('specialty_id', payload.specialty_id)
        }
        if (payload.units) {
            formData.append('units', payload.units)
        }
        if (payload.validationRules) {
            formData.append('validation_rules', JSON.stringify(payload.validationRules))
        }
        return updateAssayDefinition(formData)
    },
    deleteAssayDefinition: async (payload) => {
        if (!payload?.id) {
            return { error: 'Assay ID là bắt buộc' }
        }
        return deleteAssayDefinition(payload.id)
    },
    approveResults: async (payload) => approveResults(payload),
    cancelApproval: async (payload) => cancelApproval(payload),
    createUser: async (payload) => createUser(payload),
    updateUser: async (payload) => updateUser(payload),
    deleteUser: async (payload) => {
        if (!payload?.userId) {
            return { error: 'User ID là bắt buộc' }
        }
        return deleteUser(payload.userId)
    },
    rejectSample: async (payload) => rejectSample(payload),
    discardSample: async (payload) => discardSample(payload),
    upsertClient: async (payload) => upsertClient(payload),
    findClientByIdentity: async (payload) => {
        const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
        const dateOfBirth = typeof payload?.dateOfBirth === 'string' ? payload.dateOfBirth.trim() : ''
        if (!name) return { error: 'Tên là bắt buộc' }
        if (!dateOfBirth) return { error: 'Ngày sinh là bắt buộc' }
        if (!isIsoDateString(dateOfBirth)) return { error: 'Ngày sinh không hợp lệ' }
        return findClientByIdentity(name, dateOfBirth)
    },
    getClient: async (payload) => {
        if (!payload?.id) {
            return { error: 'Client ID là bắt buộc' }
        }
        return getClient(payload.id)
    },
    getClients: async (payload) => getClients(payload?.search),
    updateClient: async (payload) => {
        if (!payload?.id) {
            return { error: 'Client ID là bắt buộc' }
        }
        return updateClient(payload.id, payload.data)
    },
    // Signature management actions
    uploadManagerSignature: async (payload) => {
        if (!payload || !(payload instanceof FormData)) {
            return { error: 'FormData là bắt buộc' }
        }
        return uploadManagerSignature(payload)
    },
    getActiveSignature: async () => getActiveSignature(),
    getSignatureHistory: async () => getSignatureHistory(),
    downloadSignature: async (payload) => {
        if (!payload?.signaturePath) {
            return { error: 'Signature path là bắt buộc' }
        }
        return downloadSignature(payload.signaturePath)
    },
    // Search actions (PostgreSQL full-text search)
    searchSamples: async (payload) => {
        if (!payload?.query) {
            return { error: 'Từ khóa tìm kiếm là bắt buộc' }
        }
        return searchSamples(payload.query, payload.maxResults)
    },
    searchClients: async (payload) => {
        if (!payload?.query) {
            return { error: 'Từ khóa tìm kiếm là bắt buộc' }
        }
        return searchClients(payload.query, payload.maxResults)
    },
    searchAssays: async (payload) => {
        if (!payload?.query) {
            return { error: 'Từ khóa tìm kiếm là bắt buộc' }
        }
        return searchAssays(payload.query, payload.maxResults)
    },
    searchResults: async (payload) => {
        if (!payload?.query) {
            return { error: 'Từ khóa tìm kiếm là bắt buộc' }
        }
        return searchResults(payload.query, payload.maxResults)
    },
    searchAuditLogs: async (payload) => {
        if (!payload?.query) {
            return { error: 'Từ khóa tìm kiếm là bắt buộc' }
        }
        return searchAuditLogs(payload.query, payload.maxResults)
    },
    globalSearch: async (payload) => {
        if (!payload?.query) {
            return { error: 'Từ khóa tìm kiếm là bắt buộc' }
        }
        return globalSearch(payload.query, payload.maxResults)
    },
    // CoA generation actions (Phase: CoA Template Enrichment)
    generateCoA: async (payload) => {
        if (!payload?.sampleId) {
            return { error: 'Sample ID là bắt buộc' }
        }
        return generateCoA(payload.sampleId, payload.manualInputs)
    },
    regenerateCoA: async (payload) => {
        if (!payload?.sampleId) {
            return { error: 'Sample ID là bắt buộc' }
        }
        return regenerateCoA(payload.sampleId, payload.manualInputs)
    },
}

export async function POST(request: Request) {
    if (!isAllowedOrigin(request)) {
        return NextResponse.json({ error: 'Yêu cầu bị từ chối (CSRF)' }, { status: 403 })
    }

    let body: ClientActionRequest
    try {
        body = (await request.json()) as ClientActionRequest
    } catch (error) {
        return NextResponse.json({ error: 'Payload không hợp lệ' }, { status: 400 })
    }

    if (!body?.action) {
        return NextResponse.json({ error: 'Thiếu action' }, { status: 400 })
    }

    const handler = actionHandlers[body.action as ClientActionName]
    if (!handler) {
        return NextResponse.json({ error: `Action không được hỗ trợ: ${body.action}` }, { status: 400 })
    }

    try {
        const result = await handler(body.payload)

        if (result && typeof result === 'object' && 'error' in result && (result as any).error) {
            const status = mapErrorToStatus(String((result as any).error))
            return NextResponse.json(result, { status })
        }

        return NextResponse.json(result ?? { success: true })
    } catch (error) {
        console.error(`Client action ${body.action} failed`, error)
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không mong muốn'
        const derivedStatus = mapErrorToStatus(message)
        const status = derivedStatus === 400 ? 500 : derivedStatus
        return NextResponse.json({ error: message }, { status })
    }
}
