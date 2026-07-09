export const OTP_STEP_UP_ROUTE = '/otp'
export const LEGACY_MANAGER_OTP_ROUTE = '/manager/otp'

export function isOtpStepUpRoute(pathname: string) {
    return pathname === OTP_STEP_UP_ROUTE || pathname === LEGACY_MANAGER_OTP_ROUTE
}
