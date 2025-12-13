function decodeBase64Url(input: string): string {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const binary = globalThis.atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
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

