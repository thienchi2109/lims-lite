import { describe, expect, it } from 'vitest'

type ManagerOtpUserActions = {
    configureManagerOtpEmail?: unknown
    getMaskedManagerOtpEmail?: unknown
    updateOwnManagerOtpEmail?: unknown
}

async function loadUserActions() {
    const modulePath = './users'
    return import(modulePath) as Promise<ManagerOtpUserActions>
}

describe('manager OTP email user-management contract', () => {
    it('exposes an admin-only action for configuring a manager OTP email destination', async () => {
        const actions = await loadUserActions()

        expect(actions.configureManagerOtpEmail).toEqual(expect.any(Function))
    })

    it('exposes a masked read action without adding a manager self-service update action', async () => {
        const actions = await loadUserActions()

        expect(actions.getMaskedManagerOtpEmail).toEqual(expect.any(Function))
        expect(actions.updateOwnManagerOtpEmail).toBeUndefined()
    })
})
