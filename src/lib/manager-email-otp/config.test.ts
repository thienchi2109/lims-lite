import { describe, expect, it } from 'vitest'

type ManagerOtpConfig = {
    standardManager: {
        enabled: boolean
        explicitlyConfigured: boolean
    }
    confidentialManager: {
        enabled: boolean
        explicitlyConfigured: boolean
    }
    analystConfidential: {
        enabled: boolean
        explicitlyConfigured: boolean
    }
}

type ManagerOtpCohortInput = {
    role: 'analyst' | 'manager' | 'doctor'
    can_access_confidential: boolean
}

type ManagerOtpConfigModule = {
    parseManagerEmailOtpConfig: (env: NodeJS.ProcessEnv) => ManagerOtpConfig
    requiresManagerEmailOtp: (config: ManagerOtpConfig, user: ManagerOtpCohortInput) => boolean
}

async function loadConfigContract() {
    const modulePath = './config'
    return import(modulePath) as Promise<ManagerOtpConfigModule>
}

describe('manager email OTP configuration contract', () => {
    it('defaults missing flags to disabled while reporting that rollout was not explicit', async () => {
        const { parseManagerEmailOtpConfig } = await loadConfigContract()

        const config = parseManagerEmailOtpConfig({})

        expect(config).toEqual({
            standardManager: { enabled: false, explicitlyConfigured: false },
            confidentialManager: { enabled: false, explicitlyConfigured: false },
            analystConfidential: { enabled: false, explicitlyConfigured: false },
        })
    })

    it('requires OTP only for standard managers when only the standard flag is TRUE', async () => {
        const { parseManagerEmailOtpConfig, requiresManagerEmailOtp } = await loadConfigContract()
        const config = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'TRUE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'FALSE',
        })

        expect(requiresManagerEmailOtp(config, { role: 'manager', can_access_confidential: false })).toBe(true)
        expect(requiresManagerEmailOtp(config, { role: 'manager', can_access_confidential: true })).toBe(false)
    })

    it('requires OTP only for confidential managers when only the HIV flag is TRUE', async () => {
        const { parseManagerEmailOtpConfig, requiresManagerEmailOtp } = await loadConfigContract()
        const config = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'FALSE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'TRUE',
        })

        expect(requiresManagerEmailOtp(config, { role: 'manager', can_access_confidential: false })).toBe(false)
        expect(requiresManagerEmailOtp(config, { role: 'manager', can_access_confidential: true })).toBe(true)
    })

    it('supports both enabled and both disabled flag combinations', async () => {
        const { parseManagerEmailOtpConfig, requiresManagerEmailOtp } = await loadConfigContract()
        const bothEnabled = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'TRUE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'TRUE',
            ANALYST_HIV_EMAIL_OTP_ENABLED: 'FALSE',
        })
        const bothDisabled = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'FALSE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'FALSE',
            ANALYST_HIV_EMAIL_OTP_ENABLED: 'FALSE',
        })

        expect(requiresManagerEmailOtp(bothEnabled, { role: 'manager', can_access_confidential: false })).toBe(true)
        expect(requiresManagerEmailOtp(bothEnabled, { role: 'manager', can_access_confidential: true })).toBe(true)
        expect(requiresManagerEmailOtp(bothDisabled, { role: 'manager', can_access_confidential: false })).toBe(false)
        expect(requiresManagerEmailOtp(bothDisabled, { role: 'manager', can_access_confidential: true })).toBe(false)
    })

    it('rejects invalid flag values and never requires manager OTP for non-manager roles unless analyst HIV flag is enabled', async () => {
        const { parseManagerEmailOtpConfig, requiresManagerEmailOtp } = await loadConfigContract()

        expect(() => parseManagerEmailOtpConfig({ MANAGER_EMAIL_OTP_ENABLED: 'true' })).toThrow(
            /MANAGER_EMAIL_OTP_ENABLED/
        )
        expect(() => parseManagerEmailOtpConfig({ ANALYST_HIV_EMAIL_OTP_ENABLED: 'true' })).toThrow(
            /ANALYST_HIV_EMAIL_OTP_ENABLED/
        )

        const config = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'TRUE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'TRUE',
            ANALYST_HIV_EMAIL_OTP_ENABLED: 'FALSE',
        })

        expect(requiresManagerEmailOtp(config, { role: 'analyst', can_access_confidential: false })).toBe(false)
        expect(requiresManagerEmailOtp(config, { role: 'doctor', can_access_confidential: true })).toBe(false)
    })

    it('does not enforce analyst confidential OTP during Phase 1 without an analyst flag', async () => {
        const { parseManagerEmailOtpConfig, requiresManagerEmailOtp } = await loadConfigContract()
        const config = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'TRUE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'TRUE',
        })

        expect(requiresManagerEmailOtp(config, { role: 'analyst', can_access_confidential: true })).toBe(false)
    })

    it('requires OTP only for confidential analysts when the analyst HIV flag is TRUE', async () => {
        const { parseManagerEmailOtpConfig, requiresManagerEmailOtp } = await loadConfigContract()
        const config = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'FALSE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'FALSE',
            ANALYST_HIV_EMAIL_OTP_ENABLED: 'TRUE',
        })

        expect(config.analystConfidential).toEqual({ enabled: true, explicitlyConfigured: true })
        expect(requiresManagerEmailOtp(config, { role: 'analyst', can_access_confidential: true })).toBe(true)
        expect(requiresManagerEmailOtp(config, { role: 'analyst', can_access_confidential: false })).toBe(false)
        expect(requiresManagerEmailOtp(config, { role: 'manager', can_access_confidential: true })).toBe(false)
    })

    it('keeps analyst HIV OTP independent from manager OTP flags', async () => {
        const { parseManagerEmailOtpConfig, requiresManagerEmailOtp } = await loadConfigContract()
        const managerOnlyConfig = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'TRUE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'TRUE',
            ANALYST_HIV_EMAIL_OTP_ENABLED: 'FALSE',
        })
        const analystOnlyConfig = parseManagerEmailOtpConfig({
            MANAGER_EMAIL_OTP_ENABLED: 'FALSE',
            MANAGER_HIV_EMAIL_OTP_ENABLED: 'FALSE',
            ANALYST_HIV_EMAIL_OTP_ENABLED: 'TRUE',
        })

        expect(requiresManagerEmailOtp(managerOnlyConfig, { role: 'analyst', can_access_confidential: true })).toBe(false)
        expect(requiresManagerEmailOtp(analystOnlyConfig, { role: 'manager', can_access_confidential: true })).toBe(false)
    })
})
