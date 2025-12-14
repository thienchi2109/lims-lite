export const DEFAULT_SESSION_TIMEBOX_SECONDS = 4 * 60 * 60

export function getSessionTimeboxSeconds(): number {
    const raw = process.env.SESSION_TIMEBOX_SECONDS
    if (!raw) return DEFAULT_SESSION_TIMEBOX_SECONDS

    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SESSION_TIMEBOX_SECONDS

    return parsed
}

