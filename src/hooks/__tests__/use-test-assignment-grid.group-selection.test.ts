import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'

const mockFetchAssayDefinitionsClient = vi.fn()
const mockFetchMethodsClient = vi.fn()

vi.mock('@/lib/api-client', () => ({
    fetchAssayDefinitionsClient: (...args: unknown[]) => mockFetchAssayDefinitionsClient(...args),
    fetchMethodsClient: (...args: unknown[]) => mockFetchMethodsClient(...args),
}))

import { useTestAssignmentGrid } from '../use-test-assignment-grid'

type AssayMethod = AssayDefinitionWithMethods['methods'][number]

function makeMethod(
    methodId: string,
    name: string,
    isDefault = false,
): AssayMethod {
    return {
        id: `link-${methodId}`,
        method_id: methodId,
        name,
        is_default: isDefault,
        notes: null,
    }
}

function makeAssay(
    id: string,
    name: string,
    options: {
        methods?: AssayMethod[]
        methodName?: string | null
        units?: string | null
    } = {},
): AssayDefinitionWithMethods {
    return {
        id,
        name,
        specialty_id: null,
        units: options.units ?? null,
        method_name: options.methodName ?? null,
        methods: options.methods ?? [],
        validation_rules: {},
        is_confidential: false,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        deleted_at: null,
    }
}

function makeSelected(
    assay: AssayDefinitionWithMethods,
    methodId: string | null,
    methodName: string,
): SelectedTest {
    return {
        assayId: assay.id,
        methodId,
        assayName: assay.name,
        methodName,
        units: assay.units,
    }
}

function renderAssignmentGrid(
    selected: SelectedTest[] = [],
    disabledAssayIds: string[] = [],
) {
    const onChange = vi.fn()
    const hook = renderHook(() =>
        useTestAssignmentGrid({
            selected,
            onChange,
            disabledAssayIds,
            specialties: [],
        }),
    )

    return { ...hook, onChange }
}

describe('useTestAssignmentGrid group selection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchAssayDefinitionsClient.mockImplementation(() => new Promise(() => {}))
        mockFetchMethodsClient.mockImplementation(() => new Promise(() => {}))
    })

    it('selects every assay from an empty selection in display order', () => {
        const defaultAssay = makeAssay('assay-default', 'Default assay', {
            methods: [
                makeMethod('method-first', 'First method'),
                makeMethod('method-default', 'Default method', true),
            ],
            units: 'mg/L',
        })
        const firstMethodAssay = makeAssay('assay-first', 'First method assay', {
            methods: [makeMethod('method-only', 'Only method')],
        })
        const { result, onChange } = renderAssignmentGrid()

        act(() => {
            result.current.toggleGroupSelection([defaultAssay, firstMethodAssay])
        })

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([
            {
                assayId: 'assay-default',
                methodId: 'method-default',
                assayName: 'Default assay',
                methodName: 'Default method',
                units: 'mg/L',
            },
            {
                assayId: 'assay-first',
                methodId: 'method-only',
                assayName: 'First method assay',
                methodName: 'Only method',
                units: null,
            },
        ])
    })

    it('appends only missing assays and preserves existing selected objects', () => {
        const firstAssay = makeAssay('assay-first', 'First assay')
        const existingAssay = makeAssay('assay-existing', 'Existing assay')
        const lastAssay = makeAssay('assay-last', 'Last assay')
        const outsideAssay = makeAssay('assay-outside', 'Outside assay')
        const outsideSelection = makeSelected(outsideAssay, 'method-outside', 'Outside method')
        const customSelection = makeSelected(existingAssay, 'method-custom', 'Custom method')
        const { result, onChange } = renderAssignmentGrid([outsideSelection, customSelection])

        act(() => {
            result.current.toggleGroupSelection([firstAssay, existingAssay, lastAssay])
        })

        expect(onChange).toHaveBeenCalledTimes(1)
        const nextSelection = onChange.mock.calls[0][0] as SelectedTest[]
        expect(nextSelection.map((test) => test.assayId)).toEqual([
            'assay-outside',
            'assay-existing',
            'assay-first',
            'assay-last',
        ])
        expect(nextSelection[0]).toBe(outsideSelection)
        expect(nextSelection[1]).toBe(customSelection)
        expect(nextSelection[1]).toEqual(expect.objectContaining({
            methodId: 'method-custom',
            methodName: 'Custom method',
        }))
    })

    it('removes only selectable group assays when all are selected', () => {
        const firstAssay = makeAssay('assay-first', 'First assay')
        const disabledAssay = makeAssay('assay-disabled', 'Disabled assay')
        const lastAssay = makeAssay('assay-last', 'Last assay')
        const outsideAssay = makeAssay('assay-outside', 'Outside assay')
        const outsideSelection = makeSelected(outsideAssay, null, 'Outside method')
        const disabledSelection = makeSelected(disabledAssay, null, 'Disabled method')
        const selected = [
            outsideSelection,
            makeSelected(firstAssay, null, 'First method'),
            disabledSelection,
            makeSelected(lastAssay, null, 'Last method'),
        ]
        const { result, onChange } = renderAssignmentGrid(selected, [disabledAssay.id])

        act(() => {
            result.current.toggleGroupSelection([firstAssay, disabledAssay, lastAssay])
        })

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([outsideSelection, disabledSelection])
    })

    it('ignores disabled assays while selecting enabled group assays', () => {
        const disabledAssay = makeAssay('assay-disabled', 'Disabled assay')
        const enabledAssay = makeAssay('assay-enabled', 'Enabled assay')
        const { result, onChange } = renderAssignmentGrid([], [disabledAssay.id])

        act(() => {
            result.current.toggleGroupSelection([disabledAssay, enabledAssay])
        })

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange.mock.calls[0][0]).toEqual([
            expect.objectContaining({ assayId: enabledAssay.id }),
        ])
    })

    it('does nothing when a group contains only disabled assays', () => {
        const disabledAssay = makeAssay('assay-disabled', 'Disabled assay')
        const { result, onChange } = renderAssignmentGrid([], [disabledAssay.id])

        act(() => {
            result.current.toggleGroupSelection([disabledAssay])
        })

        expect(onChange).not.toHaveBeenCalled()
    })

    it('uses the active method filter for newly selected assays', () => {
        const assay = makeAssay('assay-filtered', 'Filtered assay', {
            methods: [
                makeMethod('method-default', 'Default method', true),
                makeMethod('method-filtered', 'Filtered method'),
            ],
        })
        const { result, onChange } = renderAssignmentGrid()

        act(() => {
            result.current.setSelectedMethodId('method-filtered')
        })
        act(() => {
            result.current.toggleGroupSelection([assay])
        })

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange.mock.calls[0][0]).toEqual([
            expect.objectContaining({
                assayId: assay.id,
                methodId: 'method-filtered',
                methodName: 'Filtered method',
            }),
        ])
    })

    it('uses an assay-owned method name without a method id', () => {
        const assay = makeAssay('assay-owned-method', 'Assay-owned method', {
            methodName: 'RT-PCR tự thiết lập',
        })
        const { result, onChange } = renderAssignmentGrid()

        act(() => {
            result.current.toggleGroupSelection([assay])
        })

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange.mock.calls[0][0]).toEqual([
            expect.objectContaining({
                assayId: assay.id,
                methodId: null,
                methodName: 'RT-PCR tự thiết lập',
            }),
        ])
    })
})
