import { describe, expect, it } from 'vitest'

import {
    PDF_GENERATION_RATE_LIMIT_DEFAULTS,
    PdfGenerationRateLimiter,
    type PdfGenerationRequester,
} from './rate-limit'

const staffRequester: PdfGenerationRequester = {
    identityType: 'staff',
    identityId: '11111111-1111-4111-8111-111111111111',
    ip: '203.0.113.10',
}

describe('PdfGenerationRateLimiter', () => {
    it('uses the approved five-attempt, ten-minute, 10,000-key defaults', () => {
        expect(PDF_GENERATION_RATE_LIMIT_DEFAULTS).toEqual({
            maxAttempts: 5,
            windowMs: 10 * 60 * 1000,
            maxKeys: 10_000,
        })
    })

    it.each([
        ['maxAttempts', { maxAttempts: 0 }],
        ['maxAttempts', { maxAttempts: -1 }],
        ['maxAttempts', { maxAttempts: 1.5 }],
        ['maxAttempts', { maxAttempts: Number.NaN }],
        ['maxAttempts', { maxAttempts: Number.POSITIVE_INFINITY }],
        ['windowMs', { windowMs: 0 }],
        ['windowMs', { windowMs: -1 }],
        ['windowMs', { windowMs: 1.5 }],
        ['windowMs', { windowMs: Number.NaN }],
        ['windowMs', { windowMs: Number.POSITIVE_INFINITY }],
        ['maxKeys', { maxKeys: 0 }],
        ['maxKeys', { maxKeys: -1 }],
        ['maxKeys', { maxKeys: 1.5 }],
        ['maxKeys', { maxKeys: Number.NaN }],
        ['maxKeys', { maxKeys: Number.POSITIVE_INFINITY }],
    ])('rejects invalid %s configuration', (optionName, options) => {
        expect(() => new PdfGenerationRateLimiter(options)).toThrow(
            `${optionName} must be a positive integer`,
        )
    })

    it('allows five attempts and rejects the sixth with HTTP 429', () => {
        const limiter = new PdfGenerationRateLimiter()
        const now = Date.parse('2026-07-19T00:00:00.000Z')

        for (let attempt = 1; attempt <= 5; attempt += 1) {
            expect(limiter.consume(staffRequester, now)).toEqual({
                allowed: true,
                remaining: 5 - attempt,
                resetAt: now + 10 * 60 * 1000,
            })
        }

        expect(limiter.consume(staffRequester, now)).toEqual({
            allowed: false,
            status: 429,
            reason: 'limit-exceeded',
            retryAfterSeconds: 10 * 60,
            resetAt: now + 10 * 60 * 1000,
        })
    })

    it('isolates counters by identity type, identity ID, and IP address', () => {
        const limiter = new PdfGenerationRateLimiter({ maxAttempts: 1 })
        const now = Date.parse('2026-07-19T00:00:00.000Z')

        expect(limiter.consume(staffRequester, now).allowed).toBe(true)
        expect(
            limiter.consume(
                { ...staffRequester, ip: '203.0.113.11' },
                now,
            ).allowed,
        ).toBe(true)
        expect(
            limiter.consume(
                {
                    ...staffRequester,
                    identityId: '22222222-2222-4222-8222-222222222222',
                },
                now,
            ).allowed,
        ).toBe(true)
        expect(
            limiter.consume(
                { ...staffRequester, identityType: 'client' },
                now,
            ).allowed,
        ).toBe(true)
    })

    it('starts a fresh counter when the active window reaches its boundary', () => {
        const limiter = new PdfGenerationRateLimiter({
            maxAttempts: 1,
            windowMs: 1_000,
        })
        const startedAt = Date.parse('2026-07-19T00:00:00.000Z')

        expect(limiter.consume(staffRequester, startedAt).allowed).toBe(true)
        expect(limiter.consume(staffRequester, startedAt + 999).allowed).toBe(
            false,
        )
        expect(limiter.consume(staffRequester, startedAt + 1_000)).toEqual({
            allowed: true,
            remaining: 0,
            resetAt: startedAt + 2_000,
        })
    })

    it('removes expired windows before inserting a new key at capacity', () => {
        const limiter = new PdfGenerationRateLimiter({
            maxKeys: 2,
            windowMs: 1_000,
        })
        const startedAt = Date.parse('2026-07-19T00:00:00.000Z')

        limiter.consume(staffRequester, startedAt)
        limiter.consume({ ...staffRequester, ip: '203.0.113.11' }, startedAt)

        expect(
            limiter.consume(
                { ...staffRequester, ip: '203.0.113.12' },
                startedAt + 1_000,
            ).allowed,
        ).toBe(true)
        expect(limiter.size).toBe(1)
    })

    it('rejects a new key when every bounded slot remains active', () => {
        const limiter = new PdfGenerationRateLimiter({
            maxAttempts: 5,
            maxKeys: 2,
        })
        const now = Date.parse('2026-07-19T00:00:00.000Z')
        const secondRequester = { ...staffRequester, ip: '203.0.113.11' }

        limiter.consume(staffRequester, now)
        limiter.consume(secondRequester, now)

        expect(
            limiter.consume(
                { ...staffRequester, ip: '203.0.113.12' },
                now,
            ),
        ).toEqual({
            allowed: false,
            status: 429,
            reason: 'capacity-exceeded',
            retryAfterSeconds: 10 * 60,
            resetAt: now + 10 * 60 * 1000,
        })
        expect(limiter.size).toBe(2)
        expect(limiter.consume(staffRequester, now)).toEqual({
            allowed: true,
            remaining: 3,
            resetAt: now + 10 * 60 * 1000,
        })
    })

    it('enforces the production hard cap of 10,000 active keys', () => {
        const limiter = new PdfGenerationRateLimiter()
        const now = Date.parse('2026-07-19T00:00:00.000Z')

        for (let index = 0; index < 10_000; index += 1) {
            const result = limiter.consume(
                { ...staffRequester, identityId: `staff-${index}` },
                now,
            )
            expect(result.allowed).toBe(true)
        }

        expect(limiter.size).toBe(10_000)
        expect(
            limiter.consume(
                { ...staffRequester, identityId: 'staff-over-capacity' },
                now,
            ),
        ).toMatchObject({
            allowed: false,
            status: 429,
            reason: 'capacity-exceeded',
        })
        expect(limiter.size).toBe(10_000)
    })
})
