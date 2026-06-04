function getEffectiveRequestHost(request: Request) {
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = request.headers.get('host')?.split(',')[0]?.trim()

    return forwardedHost || host || new URL(request.url).host
}

function getEffectiveRequestOrigin(request: Request) {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const effectiveHost = getEffectiveRequestHost(request)

    return `${forwardedProto || new URL(request.url).protocol.replace(':', '')}://${effectiveHost}`
}

export function isSameOriginRequest(request: Request) {
    const origin = request.headers.get('origin')
    if (!origin) return false

    try {
        const originUrl = new URL(origin)
        const effectiveOrigin = new URL(getEffectiveRequestOrigin(request))
        return originUrl.host === effectiveOrigin.host
    } catch {
        return false
    }
}
