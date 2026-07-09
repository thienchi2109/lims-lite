import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
    redirect: (url: string) => {
        throw new Error(`redirect:${url}`)
    },
}))

import ManagerOtpPage from './page'

describe('ManagerOtpPage', () => {
    it('redirects the legacy manager OTP route to the canonical shared route', async () => {
        await expect(ManagerOtpPage()).rejects.toThrow('redirect:/otp')
    })
})
