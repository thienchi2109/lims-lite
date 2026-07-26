import { describe, expect, it } from 'vitest'

import {
    APPROVAL_ERROR_MESSAGES_VI,
    ApprovalBatchItemOutcomeSchema,
    ApprovalBatchOutcomePageSchema,
    ApprovalBatchProgressSchema,
    ApprovalBatchSubmissionRequestSchema,
    ApprovalBatchSubmissionResponseSchema,
    ApprovalErrorCodeSchema,
    ApprovalErrorSchema,
    ApprovalSelectAllResponseSchema,
    RetryApprovalBatchRequestSchema,
    SingleApprovalFailureSchema,
    SingleApprovalRequestSchema,
    SingleApprovalResponseSchema,
    getApprovalErrorMessageVi,
} from './approval-batch'

const BATCH_ID = '11111111-1111-4111-8111-111111111111'
const ITEM_ID = '22222222-2222-4222-8222-222222222222'
const SAMPLE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_SAMPLE_ID = '44444444-4444-4444-8444-444444444444'
const RESULT_ID = '55555555-5555-4555-8555-555555555555'
const REQUEST_KEY = '66666666-6666-4666-8666-666666666666'
const CASE_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = '2026-07-26T02:00:00.000Z'

describe('approval P0 contracts', () => {
    it('keeps single approval compatible with the synchronous response shape', () => {
        expect(SingleApprovalRequestSchema.parse({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID],
            note: 'Đã đối chiếu',
        })).toEqual({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID],
            note: 'Đã đối chiếu',
        })
        expect(SingleApprovalResponseSchema.parse({
            success: true,
            approvedCount: 1,
        })).toEqual({
            success: true,
            approvedCount: 1,
        })
        const failure = SingleApprovalFailureSchema.parse({
            success: false,
            error: { code: 'RESULT_NOT_ENTERED' },
        })
        expect(SingleApprovalResponseSchema.parse(failure)).toEqual({
            success: false,
            error: { code: 'RESULT_NOT_ENTERED' },
        })
        expect(SingleApprovalResponseSchema.safeParse({
            error: 'raw database message',
        }).success).toBe(false)
    })

    it('rejects duplicate IDs and untrusted fields in approval requests', () => {
        expect(SingleApprovalRequestSchema.safeParse({
            sampleId: SAMPLE_ID,
            resultIds: [RESULT_ID, RESULT_ID],
        }).success).toBe(false)
        expect(ApprovalBatchSubmissionRequestSchema.safeParse({
            requestKey: REQUEST_KEY,
            selectionMode: 'selected',
            sampleIds: [SAMPLE_ID, OTHER_SAMPLE_ID],
            managerJwt: 'must-not-cross-contract-boundary',
        }).success).toBe(false)
        expect(ApprovalBatchSubmissionRequestSchema.safeParse({
            requestKey: REQUEST_KEY,
            selectionMode: 'selected',
            sampleIds: [CASE_UUID, CASE_UUID.toUpperCase()],
        }).success).toBe(false)
    })

    it('defines an idempotent batch submission capped at 200 samples', () => {
        expect(ApprovalBatchSubmissionRequestSchema.parse({
            requestKey: REQUEST_KEY,
            selectionMode: 'all_pending',
            sampleIds: [SAMPLE_ID, OTHER_SAMPLE_ID],
            note: 'Duyệt cuối ca',
        })).toEqual({
            requestKey: REQUEST_KEY,
            selectionMode: 'all_pending',
            sampleIds: [SAMPLE_ID, OTHER_SAMPLE_ID],
            note: 'Duyệt cuối ca',
        })
        expect(ApprovalBatchSubmissionRequestSchema.safeParse({
            requestKey: REQUEST_KEY,
            selectionMode: 'selected',
            sampleIds: Array.from(
                { length: 201 },
                (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
            ),
        }).success).toBe(false)
        expect(ApprovalBatchSubmissionResponseSchema.parse({
            batchId: BATCH_ID,
        })).toEqual({ batchId: BATCH_ID })
    })

    it('requires select-all count to match its exact sample snapshot', () => {
        const completeQueueSnapshot = Array.from(
            { length: 201 },
            (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
        )
        expect(ApprovalSelectAllResponseSchema.parse({
            sampleIds: completeQueueSnapshot,
            count: completeQueueSnapshot.length,
        }).count).toBe(201)
        expect(ApprovalSelectAllResponseSchema.safeParse({
            sampleIds: [SAMPLE_ID, OTHER_SAMPLE_ID],
            count: 1,
        }).success).toBe(false)
    })

    it('requires durable progress counts to equal the batch total', () => {
        const progress = {
            batchId: BATCH_ID,
            status: 'processing',
            totalCount: 4,
            queuedCount: 1,
            processingCount: 1,
            retryWaitCount: 0,
            succeededCount: 1,
            failedCount: 1,
            createdAt: NOW,
            startedAt: NOW,
            completedAt: null,
            updatedAt: NOW,
        }

        expect(ApprovalBatchProgressSchema.parse(progress)).toEqual(progress)
        expect(ApprovalBatchProgressSchema.safeParse({
            ...progress,
            totalCount: 5,
        }).success).toBe(false)
    })

    it('rejects contradictory terminal and active progress states', () => {
        const completed = {
            batchId: BATCH_ID,
            status: 'completed',
            totalCount: 2,
            queuedCount: 0,
            processingCount: 0,
            retryWaitCount: 0,
            succeededCount: 2,
            failedCount: 0,
            createdAt: NOW,
            startedAt: NOW,
            completedAt: NOW,
            updatedAt: NOW,
        }

        expect(ApprovalBatchProgressSchema.parse(completed)).toEqual(completed)
        expect(ApprovalBatchProgressSchema.safeParse({
            ...completed,
            queuedCount: 1,
            succeededCount: 1,
        }).success).toBe(false)
        expect(ApprovalBatchProgressSchema.safeParse({
            ...completed,
            completedAt: null,
        }).success).toBe(false)
        expect(ApprovalBatchProgressSchema.safeParse({
            ...completed,
            status: 'completed_with_failures',
        }).success).toBe(false)
    })

    it('keeps failed item errors sanitized and succeeded items error-free', () => {
        const failedItem = {
            itemId: ITEM_ID,
            sampleId: SAMPLE_ID,
            status: 'failed',
            attemptCount: 2,
            error: {
                code: 'QC_BLOCKED',
                params: { blockedCount: 1 },
            },
            completedAt: NOW,
        }

        expect(ApprovalBatchItemOutcomeSchema.parse(failedItem)).toEqual(failedItem)
        expect(ApprovalBatchItemOutcomeSchema.safeParse({
            ...failedItem,
            status: 'succeeded',
        }).success).toBe(false)
        expect(ApprovalBatchItemOutcomeSchema.safeParse({
            ...failedItem,
            status: 'processing',
        }).success).toBe(false)
        expect(ApprovalBatchItemOutcomeSchema.safeParse({
            ...failedItem,
            status: 'succeeded',
            error: null,
            completedAt: null,
        }).success).toBe(false)
        expect(ApprovalErrorSchema.safeParse({
            code: 'DATABASE_UNAVAILABLE',
            rawMessage: 'postgres connection string',
        }).success).toBe(false)
    })

    it('defines paginated outcomes and parent-only retry intent', () => {
        const outcome = {
            itemId: ITEM_ID,
            sampleId: SAMPLE_ID,
            status: 'succeeded',
            attemptCount: 1,
            error: null,
            completedAt: NOW,
        }

        expect(ApprovalBatchOutcomePageSchema.parse({
            batchId: BATCH_ID,
            items: [outcome],
            page: 1,
            pageSize: 20,
            totalCount: 1,
            totalPages: 1,
        }).items).toEqual([outcome])
        expect(RetryApprovalBatchRequestSchema.parse({
            parentBatchId: BATCH_ID,
            requestKey: REQUEST_KEY,
        })).toEqual({
            parentBatchId: BATCH_ID,
            requestKey: REQUEST_KEY,
        })
    })

    it('rejects contradictory outcome pagination metadata', () => {
        const outcome = {
            itemId: ITEM_ID,
            sampleId: SAMPLE_ID,
            status: 'succeeded',
            attemptCount: 1,
            error: null,
            completedAt: NOW,
        }
        const page = {
            batchId: BATCH_ID,
            items: [outcome],
            page: 1,
            pageSize: 1,
            totalCount: 1,
            totalPages: 1,
        }

        expect(ApprovalBatchOutcomePageSchema.safeParse({
            ...page,
            items: [outcome, { ...outcome, itemId: RESULT_ID }],
        }).success).toBe(false)
        expect(ApprovalBatchOutcomePageSchema.safeParse({
            ...page,
            totalCount: 0,
            totalPages: 0,
        }).success).toBe(false)
        expect(ApprovalBatchOutcomePageSchema.safeParse({
            ...page,
            totalPages: 2,
        }).success).toBe(false)
        expect(ApprovalBatchOutcomePageSchema.safeParse({
            ...page,
            page: 2,
        }).success).toBe(false)
        expect(ApprovalBatchOutcomePageSchema.safeParse({
            ...page,
            items: [],
            page: 999,
            totalCount: 0,
            totalPages: 0,
        }).success).toBe(false)
        expect(ApprovalBatchOutcomePageSchema.safeParse({
            ...page,
            items: [],
            page: 1,
            totalCount: 0,
            totalPages: 0,
        }).success).toBe(true)
    })

    it('maps every stable error code to a Vietnamese-safe message', () => {
        const codes = ApprovalErrorCodeSchema.options

        expect(Object.keys(APPROVAL_ERROR_MESSAGES_VI).sort()).toEqual(
            [...codes].sort()
        )
        for (const code of codes) {
            expect(getApprovalErrorMessageVi({ code })).toBe(
                APPROVAL_ERROR_MESSAGES_VI[code]
            )
        }
        expect(getApprovalErrorMessageVi({
            code: 'QC_BLOCKED',
            params: { blockedCount: 3 },
        })).toBe('Không thể phê duyệt vì 3 kết quả bị chặn bởi QC.')
        expect(getApprovalErrorMessageVi({
            code: 'OTP_STEP_UP_REQUIRED',
        })).toBe('Vui lòng xác thực OTP quản lý trước khi phê duyệt.')
        expect(getApprovalErrorMessageVi({
            code: 'RESULT_SAMPLE_MISMATCH',
        })).toBe('Một hoặc nhiều kết quả không thuộc mẫu cần phê duyệt.')
    })
})
