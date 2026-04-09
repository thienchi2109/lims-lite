import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useApprovalUrlState } from '../use-approval-url-state'

describe('useApprovalUrlState', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/manager/approvals?tab=review')
    })

    it('keeps setter references stable across local state updates and prop syncs', () => {
        const { result, rerender } = renderHook(
            ({ tab, sampleId }: { tab: 'review' | 'completed'; sampleId?: string | null }) =>
                useApprovalUrlState({ tab, sampleId }),
            {
                initialProps: {
                    tab: 'review' as const,
                    sampleId: null,
                },
            },
        )

        const initialSetActiveTab = result.current.setActiveTab
        const initialSetUrlSampleId = result.current.setUrlSampleId

        act(() => {
            result.current.setUrlSampleId('sample-2')
        })

        expect(result.current.setActiveTab).toBe(initialSetActiveTab)
        expect(result.current.setUrlSampleId).toBe(initialSetUrlSampleId)
        expect(result.current.urlSampleId).toBe('sample-2')

        window.history.replaceState(null, '', '/manager/approvals?tab=completed')
        rerender({ tab: 'completed', sampleId: null })

        expect(result.current.setActiveTab).toBe(initialSetActiveTab)
        expect(result.current.setUrlSampleId).toBe(initialSetUrlSampleId)
    })

    it('resolves fallback tab but not stale sample props when the live URL has no sample', () => {
        window.history.replaceState(null, '', '/manager/approvals')

        const { result } = renderHook(() =>
            useApprovalUrlState({ tab: 'completed', sampleId: 'sample-from-props' }),
        )

        expect(result.current.activeTab).toBe('completed')
        expect(result.current.urlSampleId).toBeNull()
    })

    it('uses URL state over stale props after external navigation rerenders', () => {
        const { result, rerender } = renderHook(
            ({ tab, sampleId }: { tab: 'review' | 'completed'; sampleId?: string | null }) =>
                useApprovalUrlState({ tab, sampleId }),
            {
                initialProps: {
                    tab: 'review' as const,
                    sampleId: 'sample-1',
                },
            },
        )

        expect(result.current.activeTab).toBe('review')
        expect(result.current.urlSampleId).toBeNull()

        window.history.replaceState(null, '', '/manager/approvals?tab=completed&sampleId=sample-2')
        rerender({ tab: 'review', sampleId: 'sample-1' })

        expect(result.current.activeTab).toBe('completed')
        expect(result.current.urlSampleId).toBe('sample-2')
    })

    it('does not resurrect a stale local override after navigating back to its base URL state', async () => {
        const { result, rerender } = renderHook(
            ({ tab, sampleId }: { tab: 'review' | 'completed'; sampleId?: string | null }) =>
                useApprovalUrlState({ tab, sampleId }),
            {
                initialProps: {
                    tab: 'review' as const,
                    sampleId: null,
                },
            },
        )

        act(() => {
            result.current.setUrlSampleId('sample-local')
        })
        expect(result.current.urlSampleId).toBe('sample-local')

        window.history.replaceState(null, '', '/manager/approvals?tab=completed&sampleId=sample-2')
        rerender({ tab: 'completed', sampleId: 'sample-2' })
        await waitFor(() => {
            expect(result.current.activeTab).toBe('completed')
            expect(result.current.urlSampleId).toBe('sample-2')
        })

        window.history.replaceState(null, '', '/manager/approvals?tab=review')
        rerender({ tab: 'review', sampleId: null })
        expect(result.current.activeTab).toBe('review')
        expect(result.current.urlSampleId).toBeNull()
    })
})
