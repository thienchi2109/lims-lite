/**
 * CoA stamp asset loader.
 *
 * Reads the approved SVG stamp from public assets and embeds it
 * into generated CoA HTML so stored reports remain self-contained.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

let cachedStampDataUri: string | null = null

export async function getCoAStampDataUri(): Promise<string> {
    if (cachedStampDataUri) {
        return cachedStampDataUri
    }

    const stampPath = join(process.cwd(), 'public', 'Stamp.svg')

    try {
        const stampBytes = await readFile(stampPath)
        cachedStampDataUri = `data:image/svg+xml;base64,${stampBytes.toString('base64')}`
        return cachedStampDataUri
    } catch (error) {
        console.error('Failed to load CoA stamp asset:', error)
        throw new Error('Không thể tải con dấu điện tử để tạo CoA')
    }
}
