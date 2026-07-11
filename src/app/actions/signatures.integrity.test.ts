import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockStorageDownload = vi.fn()
const mockStorageFrom = vi.fn(() => ({
    download: mockStorageDownload,
}))
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/edge-admin', () => ({
    createEdgeAdminClient: vi.fn(() => ({
        storage: {
            from: mockStorageFrom,
        },
    })),
}))

import { downloadSignature } from './signatures'

function sha256(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex')
}

function createDownloadedObject(bytes: Buffer, mimeType: string) {
    return {
        type: mimeType,
        arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    }
}

describe('downloadSignature integrity verification', () => {
    const signaturePath = 'user-1/performer-signature.png'
    const originalBytes = Buffer.from('stored performer signature')

    beforeEach(() => {
        vi.clearAllMocks()
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)
    })

    afterEach(() => {
        consoleErrorSpy.mockRestore()
    })

    it('creates a data URI when downloaded bytes match the expected hash', async () => {
        mockStorageDownload.mockResolvedValue({
            data: createDownloadedObject(originalBytes, 'image/png'),
            error: null,
        })

        const result = await downloadSignature(signaturePath, {
            useServiceRole: true,
            expectedHash: sha256(originalBytes),
        })

        expect(result).toEqual({
            success: true,
            dataUri: `data:image/png;base64,${originalBytes.toString('base64')}`,
            mimeType: 'image/png',
        })
    })

    it('fails closed when the expected hash does not match', async () => {
        mockStorageDownload.mockResolvedValue({
            data: createDownloadedObject(originalBytes, 'image/png'),
            error: null,
        })

        const result = await downloadSignature(signaturePath, {
            useServiceRole: true,
            expectedHash: sha256(Buffer.from('different signature')),
        })

        expect(result.success).toBe(false)
    })

    it('fails closed when the storage object is missing', async () => {
        mockStorageDownload.mockResolvedValue({
            data: null,
            error: new Error('Object not found'),
        })

        const result = await downloadSignature(signaturePath, {
            useServiceRole: true,
            expectedHash: sha256(originalBytes),
        })

        expect(result.success).toBe(false)
    })

    it('fails closed when downloaded bytes are corrupted', async () => {
        mockStorageDownload.mockResolvedValue({
            data: createDownloadedObject(
                Buffer.from('corrupted performer signature'),
                'image/png',
            ),
            error: null,
        })

        const result = await downloadSignature(signaturePath, {
            useServiceRole: true,
            expectedHash: sha256(originalBytes),
        })

        expect(result.success).toBe(false)
    })

    it('fails closed when the downloaded MIME type is invalid', async () => {
        mockStorageDownload.mockResolvedValue({
            data: createDownloadedObject(originalBytes, 'image/svg+xml'),
            error: null,
        })

        const result = await downloadSignature(signaturePath, {
            useServiceRole: true,
            expectedHash: sha256(originalBytes),
        })

        expect(result.success).toBe(false)
    })
})
