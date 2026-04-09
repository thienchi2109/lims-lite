export function isAllowedOrigin(request: Request) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const requestHost = new URL(request.url).host
    const headerHost = request.headers.get('host')
    const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL

    const allowedHosts = new Set<string>()
    allowedHosts.add(requestHost)
    if (headerHost) allowedHosts.add(headerHost)
    if (envSiteUrl) {
        try {
            allowedHosts.add(new URL(envSiteUrl).host)
        } catch {
            // ignore malformed SITE_URL
        }
    }

    const isHostAllowed = (value: string | null) => {
        if (!value) return false
        try {
            const host = new URL(value).host
            return allowedHosts.has(host)
        } catch {
            return allowedHosts.has(value)
        }
    }

    if (origin && !isHostAllowed(origin)) return false
    if (!origin && referer && !isHostAllowed(referer)) return false

    return true
}

export function mapErrorToStatus(message: string) {
    const normalized = message.toLowerCase()
    if (
        normalized.includes('unauthorized') ||
        normalized.includes('jws') ||
        normalized.includes('signature') ||
        normalized.includes('jwt')
    ) {
        return 401
    }
    if (normalized.includes('forbidden')) return 403
    if (normalized.includes('not found')) return 404
    return 400
}
