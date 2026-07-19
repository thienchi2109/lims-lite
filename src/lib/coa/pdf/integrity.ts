import { createHash, timingSafeEqual } from 'node:crypto'

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/

export function verifyCoaHtmlIntegrity(
    htmlBytes: Uint8Array,
    expectedSha256: string,
): boolean {
    if (!SHA256_HEX_PATTERN.test(expectedSha256)) {
        return false
    }

    const computedDigest = createHash('sha256').update(htmlBytes).digest()
    const expectedDigest = Buffer.from(expectedSha256, 'hex')

    return timingSafeEqual(computedDigest, expectedDigest)
}
