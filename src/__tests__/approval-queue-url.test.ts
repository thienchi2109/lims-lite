import { describe, expect, it } from 'vitest'
import { resolveApprovalDeepLink } from '@/lib/approval-queue-url'
import type { ApprovalQueueSample } from '@/types'

const reviewSamples: ApprovalQueueSample[] = [
    {
        id: 'sample-1',
        sample_id: 'CDC-XN-0001',
        client_name: 'Nguyen A',
        status: 'review',
        received_at: '2026-01-05T09:00:00Z',
        updated_at: '2026-01-05T10:00:00Z',
        received_by_name: 'KTV A',
        total_tests: 2,
        entered_count: 2,
        approved_count: 0,
        pending_count: 0,
        coa_reports: null,
    },
]

describe('resolveApprovalDeepLink', () => {
    it('strips a stale sampleId from the URL when the sample is not part of the active tab queue', () => {
        expect(
            resolveApprovalDeepLink({
                pathname: '/manager/approvals',
                searchParams: 'tab=completed&sampleId=sample-9&foo=bar',
                tab: 'completed',
                sampleId: 'sample-9',
                samples: reviewSamples,
            }),
        ).toEqual({
            selectedSampleId: null,
            redirectUrl: '/manager/approvals?tab=completed&foo=bar',
        })
    })

    it('keeps the deep link unchanged when the selected sample belongs to the active tab queue', () => {
        expect(
            resolveApprovalDeepLink({
                pathname: '/manager/approvals',
                searchParams: 'tab=review&sampleId=sample-1',
                tab: 'review',
                sampleId: 'sample-1',
                samples: reviewSamples,
            }),
        ).toEqual({
            selectedSampleId: 'sample-1',
            redirectUrl: null,
        })
    })
})
