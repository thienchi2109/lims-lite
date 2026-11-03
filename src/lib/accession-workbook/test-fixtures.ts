// Synthetic ZIP records and test-only finite budgets; these are not production capacity defaults.
import { crc32, deflateRawSync } from 'node:zlib'

export const resourceFixture = () => ({
    maxInflatedBytes: 64 * 1024 * 1024, maxEntries: 1024, maxCells: 1_000_000,
    maxXmlDepth: 64, maxXmlTextBytes: 256 * 1024, maxRetainedBytes: 256 * 1024 * 1024,
    maxElapsedMs: 30_000,
})

export function zipFixture(entries: [string, string | Buffer][], options: { stored?: boolean; descriptor?: boolean; comment?: number } = {}): Buffer {
    const locals: Buffer[] = [], centrals: Buffer[] = []
    let offset = 0
    for (const [path, source] of entries) {
        const name = Buffer.from(path), data = Buffer.from(source)
        const compressed = options.stored ? data : deflateRawSync(data)
        const flags = options.descriptor ? 8 : 0, checksum = crc32(data)
        const local = Buffer.alloc(30), central = Buffer.alloc(46)
        local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4)
        local.writeUInt16LE(flags, 6); local.writeUInt16LE(options.stored ? 0 : 8, 8)
        if (!options.descriptor) {
            local.writeUInt32LE(checksum, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22)
        }
        local.writeUInt16LE(name.length, 26)
        central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6)
        central.writeUInt16LE(flags, 8); central.writeUInt16LE(options.stored ? 0 : 8, 10)
        central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24)
        central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42)
        const descriptor = options.descriptor ? Buffer.alloc(16) : Buffer.alloc(0)
        if (options.descriptor) {
            descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(checksum, 4)
            descriptor.writeUInt32LE(compressed.length, 8); descriptor.writeUInt32LE(data.length, 12)
        }
        locals.push(local, name, compressed, descriptor); centrals.push(central, name)
        offset += local.length + name.length + compressed.length + descriptor.length
    }
    const directory = Buffer.concat(centrals), end = Buffer.alloc(22 + (options.comment ?? 0))
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(options.comment ?? 0, 20)
    return Buffer.concat([...locals, directory, end])
}
