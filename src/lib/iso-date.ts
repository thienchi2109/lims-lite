function isLeapYear(year: number) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number) {
    if (month === 2) return isLeapYear(year) ? 29 : 28
    if ([4, 6, 9, 11].includes(month)) return 30
    return 31
}

function isValidYmd(year: number, month: number, day: number) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
    if (year < 1900 || year > 2100) return false
    if (month < 1 || month > 12) return false
    if (day < 1 || day > daysInMonth(year, month)) return false
    return true
}

export function isIsoDateString(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return false
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    return isValidYmd(year, month, day)
}

function pad2(value: number) {
    return String(value).padStart(2, '0')
}

function toIsoDateString(year: number, month: number, day: number) {
    return `${year}-${pad2(month)}-${pad2(day)}`
}

/**
 * Normalizes a date string to ISO `yyyy-mm-dd`.
 * Supports `dd/mm/yyyy`, `dd-mm-yyyy`, `yyyy/mm/dd`, `yyyy-mm-dd`, and `ddmmyyyy` / `yyyymmdd`.
 */
export function normalizeToIsoDateString(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) return null

    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
    if (isoMatch) {
        const year = Number(isoMatch[1])
        const month = Number(isoMatch[2])
        const day = Number(isoMatch[3])
        if (!isValidYmd(year, month, day)) return null
        return toIsoDateString(year, month, day)
    }

    const ymdSlashMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed)
    if (ymdSlashMatch) {
        const year = Number(ymdSlashMatch[1])
        const month = Number(ymdSlashMatch[2])
        const day = Number(ymdSlashMatch[3])
        if (!isValidYmd(year, month, day)) return null
        return toIsoDateString(year, month, day)
    }

    const dmyMatch = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(trimmed)
    if (dmyMatch) {
        const day = Number(dmyMatch[1])
        const month = Number(dmyMatch[2])
        const year = Number(dmyMatch[3])
        if (!isValidYmd(year, month, day)) return null
        return toIsoDateString(year, month, day)
    }

    const digits8 = /^(\d{8})$/.exec(trimmed)
    if (digits8) {
        const token = digits8[1]
        const first4 = Number(token.slice(0, 4))

        // yyyymmdd (try first when plausible, but fall back to ddmmyyyy if invalid)
        if (first4 >= 1900 && first4 <= 2100) {
            const year = first4
            const month = Number(token.slice(4, 6))
            const day = Number(token.slice(6, 8))
            if (isValidYmd(year, month, day)) {
                return toIsoDateString(year, month, day)
            }
        }

        // ddmmyyyy (common on VN IDs)
        const day = Number(token.slice(0, 2))
        const month = Number(token.slice(2, 4))
        const year = Number(token.slice(4, 8))
        if (!isValidYmd(year, month, day)) return null
        return toIsoDateString(year, month, day)
    }

    return null
}
