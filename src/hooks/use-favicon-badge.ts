import { useEffect, useRef } from 'react'

type FaviconSnapshot = {
    originalHref: string
}

function clampToNonNegativeInteger(value: number) {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.floor(value))
}

function getFaviconLinks(): HTMLLinkElement[] {
    if (typeof document === 'undefined') return []

    const selector = 'link[rel="icon"], link[rel="shortcut icon"]'
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>(selector))

    return links.filter((link) => Boolean(link.href))
}

function restoreFaviconLinks(links: HTMLLinkElement[], snapshots: FaviconSnapshot[]) {
    links.forEach((link, index) => {
        const snapshot = snapshots[index]
        if (snapshot) link.href = snapshot.originalHref
    })
}

function parseLinkIconSize(link: HTMLLinkElement) {
    const sizesAttr = link.getAttribute('sizes')
    if (!sizesAttr) return 32

    const match = sizesAttr.match(/(\d+)\s*x\s*(\d+)/i)
    if (!match) return 32

    const width = Number(match[1])
    const height = Number(match[2])
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 32

    return Math.min(width, height)
}

function formatBadgeLabel(count: number, max: number) {
    if (count <= max) return String(count)
    return `${max}+`
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
        image.src = src
    })
}

async function drawBadgeFavicon({
    src,
    size,
    label,
    badgeColor,
    textColor,
}: {
    src: string
    size: number
    label: string
    badgeColor: string
    textColor: string
}) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const image = await loadImage(src)
    ctx.drawImage(image, 0, 0, size, size)

    const radius = Math.max(6, Math.round(size * 0.34))
    const centerX = size - radius
    const centerY = radius

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fillStyle = badgeColor
    ctx.fill()

    ctx.lineWidth = Math.max(1, Math.round(size * 0.08))
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.stroke()

    const labelLength = label.length
    const fontSize =
        labelLength <= 1
            ? Math.round(size * 0.58)
            : labelLength === 2
              ? Math.round(size * 0.5)
              : Math.round(size * 0.42)

    ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
    ctx.fillStyle = textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, centerX, centerY + 1)

    return canvas.toDataURL('image/png')
}

export function useFaviconBadge(
    count: number,
    options?: {
        max?: number
        badgeColor?: string
        textColor?: string
    }
) {
    const snapshotsRef = useRef<FaviconSnapshot[] | null>(null)
    const cancelledRef = useRef(false)
    const renderVersionRef = useRef(0)

    useEffect(() => {
        cancelledRef.current = false
        return () => {
            cancelledRef.current = true
            const snapshots = snapshotsRef.current ?? []
            restoreFaviconLinks(getFaviconLinks(), snapshots)
        }
    }, [])

    useEffect(() => {
        if (typeof document === 'undefined') return

        const links = getFaviconLinks()
        if (snapshotsRef.current === null) {
            snapshotsRef.current = links.map((link) => ({ originalHref: link.href }))
        }

        const snapshots = snapshotsRef.current ?? []
        const normalizedCount = clampToNonNegativeInteger(count)
        const renderVersion = ++renderVersionRef.current

        if (normalizedCount === 0) {
            restoreFaviconLinks(links, snapshots)
            return
        }

        const max = clampToNonNegativeInteger(options?.max ?? 99) || 99
        const label = formatBadgeLabel(normalizedCount, max)
        const badgeColor = options?.badgeColor ?? '#ef4444'
        const textColor = options?.textColor ?? '#ffffff'

        const update = async () => {
            for (const [index, link] of links.entries()) {
                const snapshot = snapshots[index]
                if (!snapshot) continue

                const size = parseLinkIconSize(link)
                try {
                    const dataUrl = await drawBadgeFavicon({
                        src: snapshot.originalHref,
                        size,
                        label,
                        badgeColor,
                        textColor,
                    })
                    if (cancelledRef.current || renderVersion !== renderVersionRef.current) return
                    if (dataUrl) link.href = dataUrl
                } catch {
                    // Ignore favicon drawing errors (e.g., unsupported format); keep original icon.
                }
            }
        }

        update()
    }, [count, options?.badgeColor, options?.max, options?.textColor])
}
