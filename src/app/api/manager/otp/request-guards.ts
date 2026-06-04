function getEffectiveRequestOrigin(request: Request) {
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()

    if (forwardedHost && forwardedProto) {
        return `${forwardedProto}://${forwardedHost}`
    }

    return new URL(request.url).origin
}

export function isSameOriginRequest(request: Request) {
    const origin = request.headers.get('origin')
    if (!origin) return false

    try {
        return new URL(origin).origin === getEffectiveRequestOrigin(request)
    } catch {
        return false
    }
}
