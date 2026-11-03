// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { resourceFixture, zipFixture } from './test-fixtures'

vi.mock('server-only', () => ({}))

describe('hostile accession ZIP boundary', () => {
    it('accepts stored/deflated ZIP32 and data descriptors with checked bytes', async () => {
        const { readAccessionArchive } = await import('./archive')
        for (const options of [{}, { stored: true }, { descriptor: true }]) {
            const archive = await readAccessionArchive(zipFixture([['xl/workbook.xml', '<workbook/>']], options), resourceFixture())
            expect(archive.entries.get('xl/workbook.xml')?.toString()).toBe('<workbook/>')
        }
    })

    it('enforces actual original decimal bytes before ZIP parsing', async () => {
        const { readAccessionArchive } = await import('./archive')
        const base = zipFixture([['padding', '']], { stored: true })
        const accepted = zipFixture([['padding', Buffer.alloc(9_999_999 - base.length)]], { stored: true })
        expect(accepted.length).toBe(9_999_999)
        await expect(readAccessionArchive(accepted, resourceFixture())).resolves.toHaveProperty('entries')
        for (const size of [10_000_000, 10_000_001]) await expect(readAccessionArchive(Buffer.alloc(size), resourceFixture())).rejects.toThrow('FILE_TOO_LARGE')
    })

    it.each(['crc', 'local-name', 'local-size', 'central-size', 'truncated', 'trailing', 'prefix', 'encrypted', 'zip64', 'overlap', 'descriptor'])('rejects malformed %s', async kind => {
        const { readAccessionArchive } = await import('./archive')
        let bytes = zipFixture([['a.xml', 'a'], ['b.xml', 'b']], { descriptor: kind === 'descriptor' })
        const central = bytes.indexOf(Buffer.from('504b0102', 'hex'))
        if (kind === 'crc') bytes[14] ^= 1
        if (kind === 'local-name') bytes[30] ^= 1
        if (kind === 'local-size') bytes.writeUInt32LE(999, 22)
        if (kind === 'central-size') bytes.writeUInt32LE(999, central + 24)
        if (kind === 'truncated') bytes = bytes.subarray(0, bytes.length - 1)
        if (kind === 'trailing') bytes = Buffer.concat([bytes, Buffer.from('x')])
        if (kind === 'prefix') bytes = Buffer.concat([Buffer.from('x'), bytes])
        if (kind === 'encrypted') bytes.writeUInt16LE(1, 6)
        if (kind === 'zip64') bytes.writeUInt32LE(0xffffffff, central + 24)
        if (kind === 'overlap') bytes.writeUInt32LE(0, central + 46 + 5 + 42)
        if (kind === 'descriptor') bytes[bytes.indexOf(Buffer.from('504b0708', 'hex')) + 4] ^= 1
        await expect(readAccessionArchive(bytes, resourceFixture())).rejects.toThrow('ARCHIVE_INVALID')
    })

    it.each([['../x', 'a'], ['/x', 'a'], ['a\\b', 'a'], ['a/../b', 'a']])('rejects unsafe entry path %s', async (path, data) => {
        const { readAccessionArchive } = await import('./archive')
        await expect(readAccessionArchive(zipFixture([[path, data]]), resourceFixture())).rejects.toThrow('ARCHIVE_INVALID')
    })

    it('rejects duplicates, entry exhaustion and declared/actual inflate bombs', async () => {
        const { readAccessionArchive } = await import('./archive')
        await expect(readAccessionArchive(zipFixture([['a', '1'], ['a', '2']]), resourceFixture())).rejects.toThrow('ARCHIVE_INVALID')
        await expect(readAccessionArchive(zipFixture([['a', '1'], ['b', '2']]), { ...resourceFixture(), maxEntries: 1 })).rejects.toThrow('RESOURCE_LIMIT')
        const bomb = zipFixture([['bomb.xml', 'x'.repeat(1_000_000)]])
        const central = bomb.indexOf(Buffer.from('504b0102', 'hex'))
        bomb.writeUInt32LE(1, 22); bomb.writeUInt32LE(1, central + 24)
        await expect(readAccessionArchive(bomb, { ...resourceFixture(), maxInflatedBytes: 1024 })).rejects.toThrow('RESOURCE_LIMIT')
    })

    it('requires finite trusted policy and enforces retained memory before copying bytes', async () => {
        const { readAccessionArchive } = await import('./archive')
        const bytes = zipFixture([['a', 'abc']])
        for (const value of [0, -1, Infinity, NaN]) await expect(readAccessionArchive(bytes, { ...resourceFixture(), maxCells: value })).rejects.toThrow('RESOURCE_POLICY_INVALID')
        await expect(readAccessionArchive(bytes, { ...resourceFixture(), maxRetainedBytes: 1 })).rejects.toThrow('RESOURCE_LIMIT')
    })

    it('checks actual stored bytes CRC even when local and central checksums agree', async () => {
        const { readAccessionArchive } = await import('./archive')
        const bytes = zipFixture([['a', 'abc']], { stored: true })
        const central = bytes.indexOf(Buffer.from('504b0102', 'hex'))
        bytes.writeUInt32LE(123, 14); bytes.writeUInt32LE(123, central + 16)
        await expect(readAccessionArchive(bytes, resourceFixture())).rejects.toThrow('ARCHIVE_INVALID')
    })

    it('requires a real end record within the ZIP comment search window', async () => {
        const { readAccessionArchive } = await import('./archive')
        const bytes = zipFixture([['a', 'x']], { stored: true })
        const trailing = Buffer.concat([bytes, Buffer.alloc(65_536)])
        await expect(readAccessionArchive(trailing, resourceFixture())).rejects.toThrow('ARCHIVE_INVALID')
    })

    it('yields and checks elapsed time instead of blocking a declared watchdog', async () => {
        const { readAccessionArchive } = await import('./archive')
        const bytes = zipFixture([['large', Buffer.alloc(3_000_000)]], { stored: true })
        let yielded = false
        setImmediate(() => { yielded = true })
        await expect(readAccessionArchive(bytes, { ...resourceFixture(), maxElapsedMs: 1 })).rejects.toThrow('RESOURCE_LIMIT')
        expect(yielded).toBe(true)
    })

    it('does not convert a large finite policy deadline into a one-millisecond timeout', async () => {
        const { readAccessionArchive } = await import('./archive')
        await expect(readAccessionArchive(zipFixture([['large', Buffer.alloc(1_000_000)]]), { ...resourceFixture(), maxElapsedMs: Number.MAX_SAFE_INTEGER })).resolves.toHaveProperty('entries')
    })
})
