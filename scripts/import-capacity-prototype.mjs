// Local synthetic capacity experiment only; no application or database writes.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const require = createRequire(import.meta.url)
export const XLSX = require('xlsx')
const ts = require('typescript')
export const typescriptVersion = ts.version
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// ponytail: only these existing schema modules; use the app runtime when it exists.
const sources = { './core': 'types/core', '@/lib/coa-auth': 'lib/coa-auth', '@/lib/iso-date': 'lib/iso-date', client: 'types/client-resolution' }
const cache = new Map()
function schemaModule(id) {
  if (id === 'zod') return require(id)
  if (!sources[id]) throw new Error('UNEXPECTED_SCHEMA_IMPORT')
  if (!cache.has(id)) {
    const source = readFileSync(path.join(root, 'src', sources[id] + '.ts'), 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    const loadedModule = { exports: {} }
    // coa-auth owns an unrelated cleanup timer; retain it without keeping this CLI alive.
    new Function('require', 'module', 'exports', 'setInterval', compiled)(schemaModule, loadedModule, loadedModule.exports, (...args) => setInterval(...args).unref())
    cache.set(id, loadedModule.exports)
  }
  return cache.get(id)
}
const { ResolveOrCreateClientInputSchema } = schemaModule('client')
export const LIMITS = { clients: 500, samples: 1000, assignments: 20000, fileBytes: 10485760, inflatedBytes: 33554432, entries: 256, cells: 160000 }
const headers = {
  'Hướng dẫn': ['Hướng dẫn nhập mẫu tổng hợp'],
  'Thông tin template': ['Thuộc tính', 'Giá trị'],
  'Khách hàng': ['Mã khách hàng tạm', 'Họ và tên', 'Ngày sinh', 'Loại giấy tờ', 'Số giấy tờ', 'Giới tính', 'Số điện thoại', 'Địa chỉ', 'Số BHYT', 'Ngày hết hạn BHYT'],
  'Mẫu': ['Mã mẫu tạm', 'Mã khách hàng tạm', 'Mã loại mẫu'],
  'Chỉ định': ['Mã mẫu tạm', 'Mã chỉ tiêu'],
  'Danh mục loại mẫu': ['Mã loại mẫu', 'Tên loại mẫu'],
  'Danh mục chỉ tiêu': ['Mã chỉ tiêu', 'Tên chỉ tiêu', 'Phương pháp'],
  'Danh mục tương thích': ['Mã loại mẫu', 'Mã chỉ tiêu'],
}
const fail = (code) => { throw new Error(code) }
const assay = (index) => 'CT-' + String(index + 1).padStart(6, '0')

export function makeFixture({ clients = 10, samples = 20, assignments = 100, fault, paddingChars = 0, entropy = false, extraEntries = 0 } = {}) {
  const data = Object.fromEntries(Object.entries(headers).map(([name, row]) => [name, [[...row]]]))
  data['Thông tin template'].push(...Object.entries({ template_id: 'lims-bulk-accession', template_version: '1', generated_at: '2026-11-02T00:00:00.000Z', compatibility_revision: '1', catalog_binding: 'SYNTHETIC-UNVERIFIED' }))
  data['Danh mục loại mẫu'].push(['LM-000001', 'Loại mẫu tổng hợp'])
  for (let i = 0; i < clients; i++) data['Khách hàng'].push(['KH-' + i, 'Khách tổng hợp ' + i, '2000-02-29', 'CCCD', String(100000000000 + i), 'Nam', '09' + String(10000000 + i), '', '', ''])
  for (let i = 0; i < samples; i++) data['Mẫu'].push(['M-' + i, 'KH-' + i % clients, 'LM-000001'])
  for (let i = 0; i < Math.ceil(assignments / samples); i++) {
    data['Danh mục chỉ tiêu'].push([assay(i), 'Chỉ tiêu tổng hợp ' + i, 'Phương pháp tổng hợp'])
    data['Danh mục tương thích'].push(['LM-000001', assay(i)])
  }
  for (let i = 0; i < assignments; i++) data['Chỉ định'].push(['M-' + i % samples, assay(Math.floor(i / samples))])
  let seed = 20261102
  for (let offset = 0; offset < paddingChars; offset += 30000) {
    const chars = Buffer.alloc(Math.min(30000, paddingChars - offset), 65)
    if (entropy) for (let i = 0; i < chars.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; chars[i] = 33 + ((seed >>> 0) % 90) }
    data['Hướng dẫn'].push([chars.toString('ascii')])
  }
  if (fault === 'last-reference') data['Chỉ định'].at(-1)[0] = 'M-missing'
  if (fault === 'duplicate-client') data['Khách hàng'].at(-1)[0] = 'KH-0'
  if (fault === 'duplicate-assignment') data['Chỉ định'][2] = [...data['Chỉ định'][1]]
  if (fault === 'date') data['Khách hàng'].at(-1)[2] = '2025-02-29'
  if (fault === 'numeric') data['Khách hàng'].at(-1)[4] = 123456789012
  if (fault === 'header') data['Mẫu'][0][0] = 'Header sai'
  if (fault === 'orphan') for (const row of data['Mẫu'].slice(1)) row[1] = 'KH-0'
  const workbook = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(data)) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  if (fault === 'formula') workbook.Sheets['Khách hàng'].B2.f = '"cached"'
  let buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer', compression: true })
  if (extraEntries) {
    const zip = XLSX.CFB.read(buffer, { type: 'buffer' })
    for (let i = 0; i < extraEntries; i++) XLSX.CFB.utils.cfb_add(zip, 'synthetic-' + i + '.txt', Buffer.from('x'))
    buffer = XLSX.CFB.write(zip, { type: 'buffer', fileType: 'zip', compression: true })
  }
  return buffer
}

// ZIP central-directory metadata only: not an adversarial ZIP/XML security validator.
export function preflight(buffer, limits = LIMITS) {
  if (buffer.length > limits.fileBytes) fail('FILE_LIMIT')
  let end = buffer.length - 22
  while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0 || end + 22 > buffer.length || buffer.readUInt32LE(end) !== 0x06054b50) fail('ZIP_INVALID')
  if (end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length) fail('ZIP_INVALID')
  const entries = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16), inflatedBytes = 0
  if (entries > limits.entries) fail('ENTRY_LIMIT')
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || entries === 65535) fail('ZIP_INVALID')
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) fail('ZIP_INVALID')
    if (buffer.readUInt16LE(offset + 8) & 1) fail('ZIP_INVALID')
    const inflated = buffer.readUInt32LE(offset + 24)
    if (inflated === 0xffffffff) fail('ZIP_INVALID')
    inflatedBytes += inflated
    if (inflatedBytes > limits.inflatedBytes) fail('INFLATED_LIMIT')
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
  }
  if (offset !== end || offset !== buffer.readUInt32LE(end + 16) + buffer.readUInt32LE(end + 12)) fail('ZIP_INVALID')
  return { fileBytes: buffer.length, inflatedBytes, entries }
}

export function parseWorkbook(buffer) {
  preflight(buffer)
  return XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellHTML: false, cellStyles: false, bookVBA: false, WTF: true })
}

export function validateWorkbook(workbook) {
  if (workbook.SheetNames.length !== 8 || workbook.SheetNames.some((name) => !headers[name])) fail('INVALID_SHEETS')
  if (workbook.Workbook?.Sheets?.some((sheet) => sheet.Hidden)) fail('INVALID_HIDDEN')
  let cells = 0
  const rows = {}
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name], expected = headers[name]
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    cells += (range.e.r + 1) * (range.e.c + 1)
    if (cells > LIMITS.cells) fail('CELL_LIMIT')
    if (sheet['!merges']?.length || range.e.c + 1 !== expected.length) fail('INVALID_COLUMNS')
    const output = []
    for (let row = 0; row <= range.e.r; row++) {
      const values = []
      for (let col = 0; col < expected.length; col++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })]
        if (cell && (cell.f !== undefined || cell.l || cell.t !== 's')) fail('INVALID_CELL')
        values.push(cell ? String(cell.v).normalize('NFC').trim() : '')
      }
      if (!row && values.some((value, i) => value !== expected[i])) fail('INVALID_HEADER')
      if (row && values.some(Boolean)) output.push(values)
    }
    rows[name] = output
  }
  const clients = rows['Khách hàng'], samples = rows['Mẫu'], assignments = rows['Chỉ định']
  for (const [key, values] of Object.entries({ clients, samples, assignments })) if (!values.length || values.length > LIMITS[key]) fail('COUNT_LIMIT')
  const clientRefs = new Map(), sampleRefs = new Map(), usedClients = new Set(), usedSamples = new Set(), pairs = new Set()
  const tempCode = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/
  for (const [ref, name, dateOfBirth, type, identity, gender, phone, address, insurance, expiry] of clients) {
    if (!tempCode.test(ref)) fail('INVALID_CLIENT_REF')
    if (clientRefs.has(ref)) fail('DUPLICATE_CLIENT')
    const parsed = ResolveOrCreateClientInputSchema.safeParse({ name, dateOfBirth, governmentIdentityType: type ? type.toLowerCase() : undefined, governmentIdentityValue: identity || undefined, gender, phone, address: address || null, healthInsuranceNum: insurance || null, expiryDate: expiry || null })
    if (!parsed.success || phone === '0000000000') fail('INVALID_CLIENT')
    clientRefs.set(ref, parsed.data)
  }
  const sampleTypes = new Set(rows['Danh mục loại mẫu'].map(([code]) => code))
  const assays = new Set(rows['Danh mục chỉ tiêu'].map(([code]) => code))
  const compatibility = new Set(rows['Danh mục tương thích'].map(([type, code]) => type + ':' + code))
  for (const [ref, client, type] of samples) {
    if (!tempCode.test(ref) || !clientRefs.has(client) || !/^LM-[0-9]{6}$/.test(type) || !sampleTypes.has(type)) fail('INVALID_SAMPLE')
    if (sampleRefs.has(ref)) fail('DUPLICATE_SAMPLE')
    sampleRefs.set(ref, { client, type })
    usedClients.add(client)
  }
  for (const [ref, code] of assignments) {
    if (!sampleRefs.has(ref) || !/^CT-[0-9]{6}$/.test(code) || !assays.has(code) || !compatibility.has(sampleRefs.get(ref).type + ':' + code)) fail('INVALID_ASSIGNMENT')
    const pair = ref + ':' + code
    if (pairs.has(pair)) fail('DUPLICATE_ASSIGNMENT')
    pairs.add(pair)
    usedSamples.add(ref)
  }
  if (usedClients.size !== clients.length || usedSamples.size !== samples.length) fail('ORPHAN_ROW')
  return { clients: clientRefs, samples: sampleRefs, assignments, cells }
}

// No resolver, receipt, durable preview or canonical hash is simulated here.
export function buildPreview({ clients, samples, assignments }) {
  const grouped = new Map([...samples].map(([ref, sample]) => [ref, { temporaryReference: ref, clientReference: sample.client, sampleTypeCode: sample.type, assays: [] }]))
  for (const [ref, code] of assignments) grouped.get(ref).assays.push(code)
  return { counts: { clients: clients.size, samples: samples.size, assignments: assignments.length }, samples: [...grouped.values()] }
}
