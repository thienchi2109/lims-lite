import type { Gender } from '@/types'
import { normalizeToIsoDateString } from '@/lib/iso-date'

export type ParsedClientIdentityQr = {
    idCardNum?: string
    name: string
    dateOfBirth: string // ISO yyyy-mm-dd
    gender: Gender
    address?: string
}

function stripAccents(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeGender(value: string): Gender | null {
    const normalized = stripAccents(value)
        .trim()
        .toLowerCase()
        // Remove odd prefix characters (e.g. BOM) and non-letters.
        .replace(/[^a-z]/g, '')
    if (!normalized) return null

    if (normalized === 'nam' || normalized === 'male' || normalized === 'm') return 'Nam'
    if (normalized === 'nu' || normalized === 'female' || normalized === 'f') return 'Nữ'
    return null
}

function looksLikeIdCardNumber(value: string) {
    return /^\d{9,12}$/.test(value)
}

function containsAnyDigit(value: string) {
    return /\d/.test(value)
}

function containsLetter(value: string) {
    return value.toLowerCase() !== value.toUpperCase()
}

function scoreNameCandidate(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return -1
    if (containsAnyDigit(trimmed)) return -1
    if (!containsLetter(trimmed)) return -1
    if (trimmed.includes(',')) return -1

    const words = trimmed.split(/\s+/).filter(Boolean)
    if (words.length < 2) return -1
    if (trimmed.length > 70) return -1

    let score = 0
    score += 4
    score += Math.min(words.length, 6)
    if (words.length >= 3 && words.length <= 6) score += 4
    if (!/[\/\-]/.test(trimmed)) score += 2
    return score
}

/**
 * Attempts to parse common Vietnamese ID/CCCD QR payloads.
 * Many formats are pipe-delimited with extra fields; this parser searches tokens for DOB/gender/name instead of fixed positions.
 */
export function parseClientIdentityQr(decodedText: string): ParsedClientIdentityQr | null {
    const sanitizedText = decodedText
        .replace(/\uFEFF/g, '')
        // Some handheld scanners can inject ASCII control separators (e.g. GS/FS) instead of pipes.
        .replace(/[\u001c\u001d\u001e\u001f]/g, '|')
        // Remove remaining control characters (newlines, tabs, etc).
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()

    const tokens = sanitizedText
        .split('|')
        .map((token) => token.trim())
        .filter(Boolean)

    if (tokens.length < 3) return null

    // CCCD format (commonly seen in VN): cccd|cmnd|name|ddmmyyyy|gender|address|issue_date
    // Example: 086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|...|10052021
    if (
        tokens.length >= 6 &&
        looksLikeIdCardNumber(tokens[0]) &&
        scoreNameCandidate(tokens[2]) >= 0 &&
        normalizeToIsoDateString(tokens[3]) !== null
    ) {
        const gender = normalizeGender(tokens[4]) ?? 'Khác'
        const dateOfBirth = normalizeToIsoDateString(tokens[3])
        if (!dateOfBirth) return null

        const address = tokens[5]?.trim()
        return {
            idCardNum: tokens[0],
            name: tokens[2].trim(),
            dateOfBirth,
            gender,
            address: address || undefined,
        }
    }

    const idCardNum = tokens.find(looksLikeIdCardNumber)

    const genderToken = tokens.find((token) => normalizeGender(token) !== null)
    const gender = genderToken ? (normalizeGender(genderToken) as Gender) : 'Khác'

    const dateToken = tokens.find((token) => normalizeToIsoDateString(token) !== null)
    if (!dateToken) return null

    const dateOfBirth = normalizeToIsoDateString(dateToken)
    if (!dateOfBirth) return null

    const excluded = new Set<string>()
    excluded.add(dateToken)
    if (genderToken) excluded.add(genderToken)
    if (idCardNum) excluded.add(idCardNum)

    const candidates = tokens
        .filter((token) => !excluded.has(token))
        .map((token, index) => ({ token, index, score: scoreNameCandidate(token) }))
        .filter((item) => item.score >= 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)

    const best = candidates[0]
    if (!best) return null

    return {
        idCardNum,
        name: best.token,
        dateOfBirth,
        gender,
    }
}
