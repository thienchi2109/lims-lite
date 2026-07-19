import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { verifyCoaHtmlIntegrity } from './integrity'

function sha256(content: Uint8Array): string {
    return createHash('sha256').update(content).digest('hex')
}

describe('verifyCoaHtmlIntegrity', () => {
    it('accepts the exact released HTML bytes', () => {
        const htmlBytes = Buffer.from('<main>Phiếu kết quả</main>', 'utf8')

        expect(verifyCoaHtmlIntegrity(htmlBytes, sha256(htmlBytes))).toBe(true)
    })

    it('rejects bytes that do not match the released artifact hash', () => {
        const releasedBytes = Buffer.from('<main>Bản phát hành</main>', 'utf8')
        const changedBytes = Buffer.from('<main>Bản đã thay đổi</main>', 'utf8')

        expect(verifyCoaHtmlIntegrity(changedBytes, sha256(releasedBytes))).toBe(false)
    })

    it.each([
        '',
        'not-a-sha256-hash',
        'g'.repeat(64),
        'a'.repeat(63),
        'A'.repeat(64),
    ])('fails closed for malformed expected hash %j', (expectedHash) => {
        expect(
            verifyCoaHtmlIntegrity(Buffer.from('<main>CoA</main>'), expectedHash),
        ).toBe(false)
    })
})
