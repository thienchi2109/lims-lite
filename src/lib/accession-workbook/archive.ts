// ZIP32 record validation and bounded native inflation; never trust declared ZIP sizes.
import 'server-only'
import { createInflateRaw, crc32 } from 'node:zlib'
import { assertTemplateFileSize } from '../accession-template/workbook'
import { WorkbookBudget, type WorkbookResources } from './budget'

type Entry = { name: string; flags: number; method: number; crc: number; compressed: number; expanded: number; offset: number; data: number; end: number }
const invalid = (): never => { throw new Error('ARCHIVE_INVALID') }
const CHUNK = 16 * 1024

function extras(bytes: Buffer, start: number, length: number): void {
    const end = start + length
    while (start < end) {
        if (start + 4 > end) invalid()
        const id = bytes.readUInt16LE(start), size = bytes.readUInt16LE(start + 2)
        // ZIP64, encryption, Unicode-path aliases and arbitrary alternative filenames are unsupported.
        if ([1, 0x0017, 0x9901, 0x7075].includes(id) || start + 4 + size > end) invalid()
        start += 4 + size
    }
}

async function directory(bytes: Buffer, budget: WorkbookBudget): Promise<Entry[]> {
    let end = bytes.length - 22
    for (; end >= Math.max(0, bytes.length - 65_557); end--) {
        budget.check()
        if (bytes.readUInt32LE(end) === 0x06054b50 && end + 22 + bytes.readUInt16LE(end + 20) === bytes.length) break
    }
    if (end < Math.max(0, bytes.length - 65_557) || bytes.readUInt32LE(end) !== 0x06054b50 || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length) invalid()
    const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), offset = bytes.readUInt32LE(end + 16)
    if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count || !count || count === 0xffff || offset + size !== end) invalid()
    if (count > budget.limits.maxEntries) throw new Error('RESOURCE_LIMIT')
    budget.reserve(count * 512)
    const entries: Entry[] = [], names = new Set<string>()
    let cursor = offset
    for (let index = 0; index < count; index++) {
        if (index % 32 === 0) await budget.yield()
        budget.check()
        if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50 || bytes.readUInt16LE(cursor + 6) > 20 || bytes.readUInt16LE(cursor + 34)) invalid()
        const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10)
        const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32)
        const next = cursor + 46 + nameLength + extraLength + commentLength
        if (flags & ~0x080e || ![0, 8].includes(method) || next > end || !nameLength) invalid()
        budget.reserve(nameLength * 4 + extraLength + commentLength)
        const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength)
        if (nameBytes.some(value => value < 0x20 || value > 0x7e)) invalid()
        const name = nameBytes.toString('ascii')
        if (name.startsWith('/') || name.includes('\\') || name.includes(':') || name.split('/').some(part => !part || part === '.' || part === '..') || names.has(name)) invalid()
        extras(bytes, cursor + 46 + nameLength, extraLength)
        const entry = { name, flags, method, crc: bytes.readUInt32LE(cursor + 16), compressed: bytes.readUInt32LE(cursor + 20), expanded: bytes.readUInt32LE(cursor + 24), offset: bytes.readUInt32LE(cursor + 42), data: 0, end: 0 }
        if ([entry.compressed, entry.expanded, entry.offset].includes(0xffffffff)) invalid()
        names.add(name); entries.push(entry); cursor = next
    }
    if (cursor !== end) invalid()
    entries.sort((a, b) => a.offset - b.offset)
    cursor = 0
    for (const entry of entries) {
        await budget.yield()
        budget.check()
        const local = entry.offset
        if (local !== cursor || local + 30 > offset || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 4) > 20 || bytes.readUInt16LE(local + 6) !== entry.flags || bytes.readUInt16LE(local + 8) !== entry.method) invalid()
        const nameLength = bytes.readUInt16LE(local + 26), extraLength = bytes.readUInt16LE(local + 28)
        const data = local + 30 + nameLength + extraLength
        if (data + entry.compressed > offset || nameLength !== entry.name.length || !bytes.subarray(local + 30, local + 30 + nameLength).equals(Buffer.from(entry.name, 'ascii'))) invalid()
        budget.reserve(extraLength + 128)
        extras(bytes, local + 30 + nameLength, extraLength)
        const localValues = [bytes.readUInt32LE(local + 14), bytes.readUInt32LE(local + 18), bytes.readUInt32LE(local + 22)]
        const expected = [entry.crc, entry.compressed, entry.expanded]
        if (localValues.some((value, index) => value !== expected[index] && (!(entry.flags & 8) || value !== 0))) invalid()
        cursor = data + entry.compressed
        if (entry.flags & 8) {
            if (cursor + 12 > offset) invalid()
            if (bytes.readUInt32LE(cursor) === 0x08074b50) cursor += 4
            if (cursor + 12 > offset || expected.some((value, index) => bytes.readUInt32LE(cursor + index * 4) !== value)) invalid()
            cursor += 12
        }
        entry.data = data; entry.end = cursor
    }
    if (cursor !== offset) invalid()
    return entries
}

async function expand(bytes: Buffer, entry: Entry, budget: WorkbookBudget): Promise<Buffer> {
    const compressed = bytes.subarray(entry.data, entry.data + entry.compressed)
    let checksum = 0, length = 0
    const chunks: Buffer[] = []
    // Account for native input/output buffers and async-stream bookkeeping before constructing them.
    budget.reserve(CHUNK * 8)
    const append = async (chunk: Buffer) => {
        budget.inflate(chunk.length)
        budget.reserve(chunk.length + 128)
        checksum = crc32(chunk, checksum); length += chunk.length
        chunks.push(chunk)
        await budget.yield()
    }
    if (entry.method === 0) {
        for (let offset = 0; offset < compressed.length; offset += CHUNK) await append(compressed.subarray(offset, offset + CHUNK))
    } else {
        const stream = createInflateRaw({ chunkSize: CHUNK })
        const timer = setTimeout(() => stream.destroy(new Error('RESOURCE_LIMIT')), Math.min(2_147_483_647, Math.max(1, budget.deadline - performance.now())))
        try {
            stream.end(compressed)
            for await (const chunk of stream) {
                // Async iteration can coalesce native chunks; CRC work still yields in fixed slices.
                for (let offset = 0; offset < chunk.length; offset += CHUNK) await append(chunk.subarray(offset, offset + CHUNK))
            }
            if (stream.bytesWritten !== compressed.length) invalid()
        } catch (error) {
            if (error instanceof Error && error.message === 'RESOURCE_LIMIT') throw error
            invalid()
        } finally { clearTimeout(timer); stream.destroy() }
    }
    budget.release(CHUNK * 8)
    if (length !== entry.expanded || checksum !== entry.crc) invalid()
    budget.reserve(length)
    const output = Buffer.concat(chunks, length)
    budget.release(length + chunks.length * 128)
    return output
}

export async function readAccessionArchive(input: Uint8Array, resources: WorkbookResources): Promise<{ entries: Map<string, Buffer>; budget: WorkbookBudget }> {
    if (!(input instanceof Uint8Array)) invalid()
    assertTemplateFileSize(input.byteLength)
    const budget = new WorkbookBudget(resources)
    // Count caller bytes plus the owned copy: an async caller cannot mutate records after validation.
    budget.reserve(input.byteLength * 2)
    const bytes = Buffer.from(input)
    if (bytes.length < 22) invalid()
    await budget.yield()
    const records = await directory(bytes, budget), entries = new Map<string, Buffer>()
    for (const entry of records) entries.set(entry.name, await expand(bytes, entry, budget))
    // The owned compressed copy is now unreachable; the caller's original input remains charged.
    budget.release(input.byteLength)
    return { entries, budget }
}
