/**
 * CoA Authentication Utilities
 *
 * Phase 5: Backend - Authentication & Access
 *
 * Utilities for:
 * - Phone number normalization (Vietnamese format)
 * - Passcode verification (last 6 digits)
 * - Rate limiting for authentication attempts
 */

// ============================================================================
// PHONE NORMALIZATION
// ============================================================================

/**
 * Normalize Vietnamese phone numbers to consistent format
 *
 * Converts between +84 and 0 prefix formats:
 * - +84987654321 → 0987654321
 * - 0987654321 → 0987654321
 * - 84987654321 → 0987654321
 *
 * @param phone - Phone number in any Vietnamese format
 * @returns Normalized phone number with 0 prefix, or original if invalid
 */
export function normalizePhoneVN(phone: string): string {
    // Remove all whitespace and special characters except + and digits
    const cleaned = phone.replace(/[\s\-()]/g, '')

    // Convert +84 prefix to 0
    if (cleaned.startsWith('+84')) {
        return '0' + cleaned.substring(3)
    }

    // Convert 84 prefix (without +) to 0
    if (cleaned.startsWith('84') && cleaned.length === 11) {
        return '0' + cleaned.substring(2)
    }

    // Already in 0 format
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return cleaned
    }

    // Return original if format is unexpected
    return cleaned
}

/**
 * Validate Vietnamese phone number format
 *
 * Valid formats:
 * - 0[3|5|7|8|9][0-9]{8} (10 digits starting with 0)
 * - +84[3|5|7|8|9][0-9]{8}
 * - 84[3|5|7|8|9][0-9]{8}
 *
 * @param phone - Phone number to validate
 * @returns true if valid Vietnamese mobile format
 */
export function isValidVietnamesePhone(phone: string): boolean {
    const normalized = normalizePhoneVN(phone)

    // Vietnamese mobile format: 0[3|5|7|8|9][0-9]{8}
    const mobileRegex = /^0[3|5|7|8|9][0-9]{8}$/

    return mobileRegex.test(normalized)
}

// ============================================================================
// PASSCODE VERIFICATION
// ============================================================================

/**
 * Extract last N digits from phone number for passcode
 *
 * @param phone - Normalized phone number
 * @param length - Number of digits to extract (default: 6)
 * @returns Last N digits of phone number
 */
export function extractPasscodeFromPhone(phone: string, length: number = 6): string {
    const normalized = normalizePhoneVN(phone)
    const digitsOnly = normalized.replace(/\D/g, '')
    return digitsOnly.slice(-length)
}

/**
 * Verify passcode matches last 6 digits of phone number
 *
 * @param phone - Phone number (will be normalized)
 * @param passcode - Passcode to verify (should be 6 digits)
 * @returns true if passcode matches last 6 digits of phone
 */
export function verifyPasscode(phone: string, passcode: string): boolean {
    const expected = extractPasscodeFromPhone(phone, 6)
    return passcode === expected
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
    attempts: number
    firstAttemptAt: number
    blockedUntil: number | null
}

// In-memory rate limit store (use Redis in production for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minutes block after exceeding limit
}

/**
 * Check if IP is rate limited for authentication attempts
 *
 * @param ip - Client IP address
 * @returns Object with blocked status and remaining attempts
 */
export function checkRateLimit(ip: string): {
    blocked: boolean
    remainingAttempts: number
    resetAt: Date | null
} {
    const now = Date.now()
    const entry = rateLimitStore.get(ip)

    // No entry - first attempt
    if (!entry) {
        return {
            blocked: false,
            remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts,
            resetAt: null
        }
    }

    // Check if currently blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
        return {
            blocked: true,
            remainingAttempts: 0,
            resetAt: new Date(entry.blockedUntil)
        }
    }

    // Check if window has expired - reset counter
    const windowExpired = now - entry.firstAttemptAt > RATE_LIMIT_CONFIG.windowMs
    if (windowExpired) {
        rateLimitStore.delete(ip)
        return {
            blocked: false,
            remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts,
            resetAt: null
        }
    }

    // Within window - check attempts
    const remainingAttempts = RATE_LIMIT_CONFIG.maxAttempts - entry.attempts

    if (remainingAttempts <= 0) {
        // Block the IP
        const blockedUntil = now + RATE_LIMIT_CONFIG.blockDurationMs
        entry.blockedUntil = blockedUntil
        rateLimitStore.set(ip, entry)

        return {
            blocked: true,
            remainingAttempts: 0,
            resetAt: new Date(blockedUntil)
        }
    }

    return {
        blocked: false,
        remainingAttempts,
        resetAt: new Date(entry.firstAttemptAt + RATE_LIMIT_CONFIG.windowMs)
    }
}

/**
 * Record authentication attempt for rate limiting
 *
 * @param ip - Client IP address
 * @param success - Whether authentication succeeded
 */
export function recordAuthAttempt(ip: string, success: boolean): void {
    // Only count failed attempts for rate limiting
    if (success) {
        // Clear rate limit on successful auth
        rateLimitStore.delete(ip)
        return
    }

    const now = Date.now()
    const entry = rateLimitStore.get(ip)

    if (!entry) {
        // First failed attempt
        rateLimitStore.set(ip, {
            attempts: 1,
            firstAttemptAt: now,
            blockedUntil: null
        })
    } else {
        // Increment failed attempts
        entry.attempts += 1
        rateLimitStore.set(ip, entry)
    }
}

/**
 * Clean up expired rate limit entries (run periodically)
 */
export function cleanupRateLimitStore(): void {
    const now = Date.now()

    for (const [ip, entry] of rateLimitStore.entries()) {
        const windowExpired = now - entry.firstAttemptAt > RATE_LIMIT_CONFIG.windowMs
        const blockExpired = entry.blockedUntil && entry.blockedUntil < now

        if (windowExpired || blockExpired) {
            rateLimitStore.delete(ip)
        }
    }
}

// Auto cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
}
