'use client'

export function replaceUrlWithHistory(url: string) {
    window.history.replaceState(null, '', url)
}
