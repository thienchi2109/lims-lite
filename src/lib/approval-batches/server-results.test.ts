import { describe, expect, it } from 'vitest'

import { mapApprovalBatchOutcomePage } from './server-results'

const BATCH_ID = '22222222-2222-4222-8222-222222222222'

describe('approval batch database response validation', () => {
    it('rejects outcome pages whose database pagination metadata mismatches the request', () => {
        expect(mapApprovalBatchOutcomePage(
            {
                batch_id: BATCH_ID,
                total: 50,
                limit: 50,
                offset: 0,
                items: [],
            },
            2,
            25,
        )).toBeNull()
    })
})
