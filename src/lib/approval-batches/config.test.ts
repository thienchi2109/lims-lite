import { afterEach, describe, expect, it, vi } from 'vitest'

import { isBackgroundBatchResultApprovalEnabled } from './config'

describe('background batch result approval feature flag', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('defaults to disabled and only enables for the explicit TRUE value', () => {
        vi.stubEnv('BACKGROUND_BATCH_RESULT_APPROVAL_ENABLED', undefined)
        expect(isBackgroundBatchResultApprovalEnabled()).toBe(false)

        vi.stubEnv('BACKGROUND_BATCH_RESULT_APPROVAL_ENABLED', 'false')
        expect(isBackgroundBatchResultApprovalEnabled()).toBe(false)

        vi.stubEnv('BACKGROUND_BATCH_RESULT_APPROVAL_ENABLED', 'TRUE')
        expect(isBackgroundBatchResultApprovalEnabled()).toBe(true)
    })
})
