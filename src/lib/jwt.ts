function decodeBase64Url(input: string): string {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(padded)
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
        return new TextDecoder().decode(bytes)
    }

    // Node.js fallback (some runtimes do not provide atob)
    const buffer = Buffer.from(padded, 'base64')
    return buffer.toString('utf-8')
}

export function decodeJwtPayload<T extends Record<string, unknown>>(jwt: string): T | null {
    const parts = jwt.split('.')
    if (parts.length < 2) return null

    try {
        const json = decodeBase64Url(parts[1])
        return JSON.parse(json) as T
    } catch {
        return null
    }
}

// ============================================================================
// COA DOWNLOAD TOKEN UTILITIES (Phase 5)
// ============================================================================

/**
 * JWT Utilities for CoA Download Tokens
 *
 * Provides JWT signing and verification for CoA download tokens
 */

import { SignJWT, jwtVerify } from 'jose'
import type { CoADownloadToken } from '@/types'

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOKEN_EXPIRY_HOURS = 1 // 1 hour token expiry

let cachedSecret: Uint8Array | null = null

function getJwtSigningSecret(): Uint8Array {
    if (cachedSecret) return cachedSecret

    const rawSecret = process.env.JWT_SECRET?.trim() || process.env.SUPABASE_JWT_SECRET?.trim()
    if (!rawSecret) {
        throw new Error('Missing JWT secret: set JWT_SECRET (recommended) or SUPABASE_JWT_SECRET')
    }

    if (rawSecret.length < 32) {
        throw new Error('JWT secret must be at least 32 characters long')
    }

    cachedSecret = new TextEncoder().encode(rawSecret)
    return cachedSecret
}

// ============================================================================
// JWT SIGNING
// ============================================================================

/**
 * Create JWT token for CoA download authorization
 *
 * @param payload - Token payload with client_id and optional sample_id
 * @returns Signed JWT token string
 */
export async function createCoAToken(payload: Omit<CoADownloadToken, 'exp'>): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + (TOKEN_EXPIRY_HOURS * 60 * 60)

    const token = await new SignJWT({ ...payload, exp })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(getJwtSigningSecret())

    return token
}

// ============================================================================
// JWT VERIFICATION
// ============================================================================

/**
 * Verify and decode CoA download token
 *
 * @param token - JWT token string
 * @returns Decoded token payload if valid
 * @throws Error if token is invalid or expired
 */
export async function verifyCoAToken(token: string): Promise<CoADownloadToken> {
    try {
        const { payload } = await jwtVerify(token, getJwtSigningSecret(), {
            algorithms: ['HS256'],
        })

        // Validate payload structure
        if (
            typeof payload.client_id !== 'string' ||
            typeof payload.exp !== 'number'
        ) {
            throw new Error('Invalid token payload structure')
        }

        return {
            client_id: payload.client_id,
            sample_id: payload.sample_id as string | undefined,
            exp: payload.exp,
        }
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Token verification failed: ${error.message}`)
        }
        throw new Error('Token verification failed')
    }
}

/**
 * Check if token is expired
 *
 * @param token - Decoded token payload
 * @returns true if token is expired
 */
export function isTokenExpired(token: CoADownloadToken): boolean {
    const now = Math.floor(Date.now() / 1000)
    return token.exp < now
}
