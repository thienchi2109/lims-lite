export type ManagerOtpConfig = {
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

export type ManagerOtpCohortInput = {
    role: 'analyst' | 'manager' | 'doctor' | string | null | undefined
    can_access_confidential: boolean | null | undefined
}

type FlagName = 'MANAGER_EMAIL_OTP_ENABLED' | 'MANAGER_HIV_EMAIL_OTP_ENABLED' | 'ANALYST_HIV_EMAIL_OTP_ENABLED'

function parseFlag(env: NodeJS.ProcessEnv, name: FlagName) {
    const raw = env[name]

    if (raw === undefined || raw === '') {
        return { enabled: false, explicitlyConfigured: false }
    }

    if (raw === 'TRUE') {
        return { enabled: true, explicitlyConfigured: true }
    }

    if (raw === 'FALSE') {
        return { enabled: false, explicitlyConfigured: true }
    }

    throw new Error(`${name} must be either TRUE or FALSE`)
}

export function parseManagerEmailOtpConfig(env: NodeJS.ProcessEnv = process.env): ManagerOtpConfig {
    return {
        standardManager: parseFlag(env, 'MANAGER_EMAIL_OTP_ENABLED'),
        confidentialManager: parseFlag(env, 'MANAGER_HIV_EMAIL_OTP_ENABLED'),
        analystConfidential: parseFlag(env, 'ANALYST_HIV_EMAIL_OTP_ENABLED'),
    }
}

export function requiresManagerEmailOtp(
    config: ManagerOtpConfig,
    user: ManagerOtpCohortInput,
): boolean {
    if (user.role === 'manager') {
        return user.can_access_confidential === true
            ? config.confidentialManager.enabled
            : config.standardManager.enabled
    }

    if (user.role === 'analyst' && user.can_access_confidential === true) {
        return config.analystConfidential.enabled
    }

    return false
}
