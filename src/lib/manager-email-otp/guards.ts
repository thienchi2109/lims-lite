import {
    parseManagerEmailOtpConfig,
    requiresManagerEmailOtp,
    type ManagerOtpCohortInput,
} from './config'
import {
    MANAGER_STEP_UP_COOKIE_NAME,
    getManagerStepUpSecret,
    verifyManagerStepUpCookieValue,
} from './step-up'

export const MANAGER_OTP_REQUIRED_ERROR = 'Yêu cầu xác thực OTP email quản lý trước khi tiếp tục'

type CookieReader = {
    get(name: string): { value: string } | undefined
}

export type ManagerOtpPrincipal = ManagerOtpCohortInput & {
    userId: string
    sessionId: string | null | undefined
    otpEmailUpdatedAt?: string | null
}

export function getManagerOtpCohort(user: ManagerOtpCohortInput) {
    if (user.role !== 'manager') {
        return null
    }

    return user.can_access_confidential === true ? 'confidential' : 'standard'
}

export function managerRequiresOtp(principal: ManagerOtpCohortInput) {
    return requiresManagerEmailOtp(parseManagerEmailOtpConfig(process.env), principal)
}

export async function hasValidManagerStepUp(principal: ManagerOtpPrincipal, cookies: CookieReader) {
    const cohort = getManagerOtpCohort(principal)
    if (!cohort || !principal.sessionId || !principal.otpEmailUpdatedAt) {
        return false
    }

    const result = await verifyManagerStepUpCookieValue(
        cookies.get(MANAGER_STEP_UP_COOKIE_NAME)?.value,
        {
            userId: principal.userId,
            sessionId: principal.sessionId,
            cohort,
            otpEmailUpdatedAt: principal.otpEmailUpdatedAt,
            expiresAt: new Date(Date.now() + 1),
            now: new Date(),
            secret: getManagerStepUpSecret(),
        },
    )

    return result.ok
}

export async function shouldRequireManagerStepUp(principal: ManagerOtpPrincipal, cookies: CookieReader) {
    return managerRequiresOtp(principal) && !(await hasValidManagerStepUp(principal, cookies))
}
