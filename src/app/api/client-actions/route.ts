import { NextResponse } from 'next/server'
import {
    assignTests,
    updateSample,
    accessionAndAssignTests,
    getSampleTests,
    getSamples,
    submitSampleForReview,
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
import type { ClientActionName, ClientActionRequest } from '@/lib/client-actions/types'

interface ActionHandler {
    (payload?: any): Promise<any>
}

const actionHandlers: Record<ClientActionName, ActionHandler> = {
    getSamples: async (payload) => getSamples(payload),
    assignTests: async (payload) => assignTests(payload),
    updateSample: async (payload) => updateSample(payload),
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
}

export async function POST(request: Request) {
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
        return NextResponse.json(result ?? { success: true })
    } catch (error) {
        console.error(`Client action ${body.action} failed`, error)
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không mong muốn'
        return NextResponse.json({ error: message })
    }
}
