import type { QCSessionListParams } from './sessions'

// ============================================================================
// QC QUERY KEYS - For TanStack Query cache management
// ============================================================================

export const qcKeys = {
    all: ['qc'] as const,
    materials: {
        all: ['qc', 'materials'] as const,
        list: () => ['qc', 'materials', 'list'] as const,
        detail: (id: string) => ['qc', 'materials', id] as const,
    },
    definitions: {
        all: ['qc', 'definitions'] as const,
        list: (assayId?: string) => ['qc', 'definitions', 'list', { assayId }] as const,
        detail: (id: string) => ['qc', 'definitions', id] as const,
        byAssay: (assayId: string) => ['qc', 'definitions', 'assay', assayId] as const,
    },
    sessions: {
        all: ['qc', 'sessions'] as const,
        list: (params?: QCSessionListParams) => ['qc', 'sessions', 'list', params] as const,
        detail: (id: string) => ['qc', 'sessions', id] as const,
        active: (assayId: string) => ['qc', 'sessions', 'active', assayId] as const,
    },
    results: {
        all: ['qc', 'results'] as const,
        bySession: (sessionId: string) => ['qc', 'results', 'session', sessionId] as const,
        byDefinition: (definitionId: string) => ['qc', 'results', 'definition', definitionId] as const,
        history: (definitionId: string, days: number) => ['qc', 'results', 'history', definitionId, days] as const,
    },
    violations: {
        all: ['qc', 'violations'] as const,
        pending: () => ['qc', 'violations', 'pending'] as const,
        bySession: (sessionId: string) => ['qc', 'violations', 'session', sessionId] as const,
        detail: (id: string) => ['qc', 'violations', id] as const,
    },
    tea: {
        all: ['qc', 'tea'] as const,
        byAssay: (assayId: string) => ['qc', 'tea', 'assay', assayId] as const,
    },
    chart: (definitionId: string, days: number) => ['qc', 'chart', definitionId, days] as const,
    approvalCheck: (resultIds: string[]) => ['qc', 'approval-check', resultIds] as const,
}
