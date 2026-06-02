import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

import { MANAGER_STEP_UP_COOKIE_NAME } from '@/lib/manager-email-otp/step-up'
import { POST } from './route'

describe('manager OTP logout contract', () => {
    it('clears manager step-up state on logout', async () => {
        mocks.createClient.mockResolvedValue({
            auth: {
                signOut: vi.fn(async () => ({ error: null })),
            },
        })

        const response = await POST()

        expect(response.cookies.get(MANAGER_STEP_UP_COOKIE_NAME)?.value).toBe('')
    })
})
