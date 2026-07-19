export const PDF_GENERATION_RATE_LIMIT_DEFAULTS = {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000,
    maxKeys: 10_000,
} as const

export type PdfGenerationRequester = {
    identityType: 'staff' | 'client'
    identityId: string
    ip: string
}

export type PdfGenerationRateLimitOptions = {
    maxAttempts?: number
    windowMs?: number
    maxKeys?: number
}

type AllowedDecision = {
    allowed: true
    remaining: number
    resetAt: number
}

type RejectedDecision = {
    allowed: false
    status: 429
    reason: 'limit-exceeded' | 'capacity-exceeded'
    retryAfterSeconds: number
    resetAt: number
}

export type PdfGenerationRateLimitDecision =
    | AllowedDecision
    | RejectedDecision

type RateLimitEntry = {
    attempts: number
    resetAt: number
}

function requirePositiveInteger(name: string, value: number): number {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive integer`)
    }

    return value
}

export class PdfGenerationRateLimiter {
    private readonly entries = new Map<string, RateLimitEntry>()
    private readonly maxAttempts: number
    private readonly windowMs: number
    private readonly maxKeys: number

    constructor(options: PdfGenerationRateLimitOptions = {}) {
        this.maxAttempts = requirePositiveInteger(
            'maxAttempts',
            options.maxAttempts ?? PDF_GENERATION_RATE_LIMIT_DEFAULTS.maxAttempts,
        )
        this.windowMs = requirePositiveInteger(
            'windowMs',
            options.windowMs ?? PDF_GENERATION_RATE_LIMIT_DEFAULTS.windowMs,
        )
        this.maxKeys = requirePositiveInteger(
            'maxKeys',
            options.maxKeys ?? PDF_GENERATION_RATE_LIMIT_DEFAULTS.maxKeys,
        )
    }

    get size(): number {
        return this.entries.size
    }

    consume(
        requester: PdfGenerationRequester,
        now = Date.now(),
    ): PdfGenerationRateLimitDecision {
        const key = JSON.stringify([
            requester.identityType,
            requester.identityId,
            requester.ip,
        ])
        let entry = this.entries.get(key)

        if (entry && now >= entry.resetAt) {
            this.entries.delete(key)
            entry = undefined
        }

        if (!entry) {
            if (this.entries.size >= this.maxKeys) {
                this.removeExpiredEntries(now)
            }

            if (this.entries.size >= this.maxKeys) {
                const resetAt = this.findEarliestResetAt()
                return this.createRejectedDecision(
                    'capacity-exceeded',
                    resetAt,
                    now,
                )
            }

            entry = {
                attempts: 0,
                resetAt: now + this.windowMs,
            }
            this.entries.set(key, entry)
        }

        if (entry.attempts >= this.maxAttempts) {
            return this.createRejectedDecision(
                'limit-exceeded',
                entry.resetAt,
                now,
            )
        }

        entry.attempts += 1

        return {
            allowed: true,
            remaining: this.maxAttempts - entry.attempts,
            resetAt: entry.resetAt,
        }
    }

    private removeExpiredEntries(now: number): void {
        for (const [key, entry] of this.entries) {
            if (now >= entry.resetAt) {
                this.entries.delete(key)
            }
        }
    }

    private findEarliestResetAt(): number {
        let earliestResetAt = Number.POSITIVE_INFINITY

        for (const entry of this.entries.values()) {
            earliestResetAt = Math.min(earliestResetAt, entry.resetAt)
        }

        return earliestResetAt
    }

    private createRejectedDecision(
        reason: RejectedDecision['reason'],
        resetAt: number,
        now: number,
    ): RejectedDecision {
        return {
            allowed: false,
            status: 429,
            reason,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil((resetAt - now) / 1000),
            ),
            resetAt,
        }
    }
}
