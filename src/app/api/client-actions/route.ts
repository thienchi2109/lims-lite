import { NextResponse } from 'next/server'
import {
    updateSample,
    createSample,
    accessionAndAssignTests,
    recordSampleLabelPrint,
    getSamples,
} from '@/app/actions/samples'
import {
    assignTests,
    getSampleTests,
} from '@/app/actions/sample-tests'
import { getSamplesForApprovalCount, getRejectedSamplesCount, getSamplesWithTab, submitSampleForReview, rejectSample, discardSample } from '@/app/actions/sample-approvals'
import { getResultsBySample, saveBatchResults } from '@/app/actions/results'
import { getSampleSubmissionReview } from '@/app/actions/submission-reviews'
import { approveResults, cancelApproval } from '@/app/actions/results-approval'
import { getAssayDefinitions as fetchAssayDefinitions } from '@/app/actions/assay-queries'
import { getMethodNameSuggestions, getMethods } from '@/app/actions/assay-lookups'
import {
    createAssayDefinition,
    updateAssayDefinition,
    deleteAssayDefinition,
} from '@/app/actions/assay-mutations'
import {
    cloneAssaySampleTypeCatalogRevision,
    getAssaySampleTypeCatalogManager,
    getPublishedAssaySampleTypeCatalog,
    publishAssaySampleTypeCatalogRevision,
    reviewAssaySampleTypeCatalogRevision,
    updateAssaySampleTypeCatalogReview,
} from '@/app/actions/assay-sample-type-compatibility'
import {
    addMethodToAssay,
    setDefaultMethod,
    removeMethodFromAssay,
} from '@/app/actions/assay-methods'
import { createUser, updateUser, deleteUser } from '@/app/actions/users'
import { configureManagerOtpEmail, getMaskedManagerOtpEmail } from '@/app/actions/users-manager-otp'
import {
    upsertClient,
    findClientByIdentity,
    getClient,
    getClients,
    updateClient,
} from '@/app/actions/clients'
import {
    adjudicateClientCollision,
    correctClientIdentity,
    deactivateClient,
    getClientLifecycleDetailManager,
    getClientLifecycleManager,
    restoreClient,
} from '@/app/actions/client-lifecycle'
import {
    resolveClientIdentityV2,
    resolveOrCreateClientV2,
} from '@/lib/client-resolution/server'
import {
    uploadSignature,
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
import { ConfigureManagerOtpEmailSchema, UpdateUserSchema } from '@/types'
import type { ClientActionName, ClientActionRequest } from '@/lib/client-actions/types'
import { isAllowedOrigin, mapErrorToStatus } from './route-helpers'
import { getClientActionDenial } from './role-guard'

// The JSON client-action bridge intentionally accepts heterogeneous payloads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionHandler = (payload?: any) => Promise<unknown>

type ActionErrorResult = {
    error?: unknown
}

function hasActionErrorResult(result: unknown): result is ActionErrorResult {
    return (
        typeof result === 'object' &&
        result !== null &&
        'error' in result &&
        Boolean((result as ActionErrorResult).error)
    )
}

const actionHandlers: Record<ClientActionName, ActionHandler> = {
    getSamples: async (payload) => getSamples(payload),
    getSamplesWithTab: async (payload) => {
        if (payload?.tab !== 'review' && payload?.tab !== 'completed') {
            return { error: 'Approval tab không hợp lệ' }
        }
        return getSamplesWithTab(payload.tab)
    },
    getSamplesForApprovalCount: async () => getSamplesForApprovalCount(),
    getRejectedSamplesCount: async () => getRejectedSamplesCount(),
    assignTests: async (payload) => assignTests(payload),
    updateSample: async (payload) => updateSample(payload),
    createSample: async (payload) => createSample(payload),
    accessionAndAssignTests: async (payload) => accessionAndAssignTests(payload),
    recordSampleLabelPrint: async (payload) => recordSampleLabelPrint(payload),
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
    getSampleSubmissionReview: async (payload) => {
        if (!payload?.sampleId) {
            return { error: 'Sample ID is required' }
        }
        return getSampleSubmissionReview(payload.sampleId)
    },
    saveBatchResults: async (payload) => saveBatchResults(payload),
    submitSampleForReview: async (payload) => submitSampleForReview(payload),
    getAssayDefinitions: async (payload) => fetchAssayDefinitions(payload),
    getMethods: async () => getMethods(),
    getMethodNameSuggestions: async () => getMethodNameSuggestions(),
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
        if (payload.methodName) {
            formData.append('method_name', payload.methodName)
        }
        if (payload.units) {
            formData.append('units', payload.units)
        }
        if (typeof payload.normalRange === 'string') {
            formData.append('normal_range', payload.normalRange)
        }
        if (typeof payload.is_confidential === 'boolean') {
            formData.append('is_confidential', String(payload.is_confidential))
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
        if (payload.methodName) {
            formData.append('method_name', payload.methodName)
        }
        if (typeof payload.normalRange === 'string') {
            formData.append('normal_range', payload.normalRange)
        }
        if (typeof payload.is_confidential === 'boolean') {
            formData.append('is_confidential', String(payload.is_confidential))
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
    getAssaySampleTypeCatalogManager: async (payload) =>
        getAssaySampleTypeCatalogManager(payload),
    getPublishedAssaySampleTypeCatalog: async (payload) =>
        getPublishedAssaySampleTypeCatalog(payload),
    cloneAssaySampleTypeCatalogRevision: async (payload) =>
        cloneAssaySampleTypeCatalogRevision(payload),
    updateAssaySampleTypeCatalogReview: async (payload) =>
        updateAssaySampleTypeCatalogReview(payload),
    reviewAssaySampleTypeCatalogRevision: async (payload) =>
        reviewAssaySampleTypeCatalogRevision(payload),
    publishAssaySampleTypeCatalogRevision: async (payload) =>
        publishAssaySampleTypeCatalogRevision(payload),
    approveResults: async (payload) => approveResults(payload),
    cancelApproval: async (payload) => cancelApproval(payload),
    createUser: async (payload) => createUser(payload),
    updateUser: async (payload) => {
        if (payload && typeof payload === 'object' && 'role' in payload) {
            return { error: 'Vai trò chỉ được xác định khi tạo tài khoản' }
        }

        const parsed = UpdateUserSchema.safeParse(payload)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message ?? 'Thông tin người dùng không hợp lệ' }
        }

        return updateUser(parsed.data)
    },
    deleteUser: async (payload) => {
        if (!payload?.userId) {
            return { error: 'User ID là bắt buộc' }
        }
        return deleteUser(payload.userId)
    },
    configureManagerOtpEmail: async (payload) => {
        const parsed = ConfigureManagerOtpEmailSchema.safeParse(payload)
        if (!parsed.success) {
            return { error: parsed.error.issues[0]?.message ?? 'Thông tin email OTP không hợp lệ' }
        }
        return configureManagerOtpEmail(parsed.data)
    },
    getMaskedManagerOtpEmail: async (payload) => {
        if (!payload?.userId) {
            return { error: 'User ID là bắt buộc' }
        }
        return getMaskedManagerOtpEmail(payload.userId)
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
    resolveClientIdentityV2: async (payload) =>
        resolveClientIdentityV2(payload),
    resolveOrCreateClientV2: async (payload) =>
        resolveOrCreateClientV2(payload),
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
    getClientLifecycleManager: async (payload) => getClientLifecycleManager(payload),
    getClientLifecycleDetailManager: async (payload) =>
        getClientLifecycleDetailManager(payload),
    deactivateClient: async (payload) => deactivateClient(payload),
    restoreClient: async (payload) => restoreClient(payload),
    correctClientIdentity: async (payload) => correctClientIdentity(payload),
    adjudicateClientCollision: async (payload) =>
        adjudicateClientCollision(payload),
    // Signature management actions
    uploadManagerSignature: async (payload) => {
        // @deprecated - kept for backward compatibility
        if (!payload || !(payload instanceof FormData)) {
            return { error: 'FormData là bắt buộc' }
        }
        return uploadSignature(payload)
    },
    uploadSignature: async (payload) => {
        if (!payload || !(payload instanceof FormData)) {
            return { error: 'FormData là bắt buộc' }
        }
        return uploadSignature(payload)
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
    } catch {
        return NextResponse.json({ error: 'Payload không hợp lệ' }, { status: 400 })
    }

    if (!body?.action) {
        return NextResponse.json({ error: 'Thiếu action' }, { status: 400 })
    }

    const handler = actionHandlers[body.action as ClientActionName]
    if (!handler) {
        return NextResponse.json({ error: `Action không được hỗ trợ: ${body.action}` }, { status: 400 })
    }

    const actionDenial = await getClientActionDenial(body.action as ClientActionName, request)
    if (actionDenial) {
        return NextResponse.json({ error: actionDenial.error }, { status: actionDenial.status })
    }

    try {
        const result = await handler(body.payload)

        if (hasActionErrorResult(result)) {
            const status = mapErrorToStatus(String(result.error))
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
