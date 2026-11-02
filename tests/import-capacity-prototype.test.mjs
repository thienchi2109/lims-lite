// Runnable synthetic checks for capacity guards and all-or-nothing local preview.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { makeFixture, preflight, parseWorkbook, validateWorkbook, buildPreview, LIMITS } from '../scripts/import-capacity-prototype.mjs'

const prepare = (options) => validateWorkbook(parseWorkbook(makeFixture(options)))

test('eight-sheet synthetic fixture yields complete preview without official IDs', () => {
  const rows = prepare({ clients: 2, samples: 3, assignments: 6 })
  const preview = buildPreview(rows)
  assert.deepEqual(preview.counts, { clients: 2, samples: 3, assignments: 6 })
  assert.equal(preview.samples.length, 3)
  assert.equal(preview.samples[0].assays.length, 2)
  assert.equal(JSON.stringify(preview).includes('officialId'), false)
})

const formerCounts = { clients: 500, samples: 1000, assignments: 20000 }
for (const key of Object.keys(formerCounts)) test('former ' + key + ' cap +1 produces complete preview', () => {
  const counts = { ...formerCounts, [key]: formerCounts[key] + 1 }
  assert.deepEqual(buildPreview(prepare(counts)).counts, counts)
})

test('decimal 10 MB is strict: valid 9,999,999-byte XLSX previews, exact/above reject before decode', () => {
  for (const fileBytes of [9999999, 10000000, 10000001]) {
    const bytes = makeFixture({ ...formerCounts, paddingChars: 8000000, entropy: true, fileBytes })
    assert.equal(preflight(bytes, { ...LIMITS, fileBytes: 10000002 }).fileBytes, fileBytes)
    if (fileBytes === 9999999) assert.deepEqual(buildPreview(validateWorkbook(parseWorkbook(bytes))).counts, formerCounts)
    else assert.throws(() => parseWorkbook(bytes), /FILE_LIMIT/)
  }
  assert.equal(LIMITS.fileBytes, 10000000)
})

test('empty batches remain invalid without business count caps', () => {
  for (const [sheet, range] of [['Khách hàng', 'A1:J1'], ['Mẫu', 'A1:C1'], ['Chỉ định', 'A1:B1']]) {
    const workbook = parseWorkbook(makeFixture())
    workbook.Sheets[sheet]['!ref'] = range
    assert.throws(() => validateWorkbook(workbook), /EMPTY_BATCH/)
  }
})

test('invalid last row, duplicate refs/pairs, numeric cell and invalid leap date reject', () => {
  for (const fault of ['last-reference', 'duplicate-client', 'duplicate-assignment', 'numeric', 'date', 'formula', 'header', 'orphan']) {
    assert.throws(() => prepare({ clients: 2, samples: 3, assignments: 6, fault }), /INVALID_|DUPLICATE_|ORPHAN_/, fault)
  }
})

test('ZIP guards reject malformed, oversize, inflated, entry-count and truncated input', () => {
  assert.throws(() => preflight(Buffer.from('not a workbook')), /ZIP_INVALID/)
  assert.throws(() => preflight(Buffer.alloc(LIMITS.fileBytes + 1)), /FILE_LIMIT/)
  const bytes = makeFixture({ clients: 1, samples: 1, assignments: 1 })
  assert.throws(() => preflight(bytes, { ...LIMITS, inflatedBytes: 1 }), /INFLATED_LIMIT/)
  assert.throws(() => preflight(bytes, { ...LIMITS, entries: 1 }), /ENTRY_LIMIT/)
  assert.throws(() => preflight(bytes.subarray(0, bytes.length - 10)), /ZIP_INVALID/)
  assert.ok(preflight(bytes).inflatedBytes > bytes.length)
})

test('empty formula marker and inflated worksheet range reject without preview', () => {
  const workbook = parseWorkbook(makeFixture())
  workbook.Sheets['Khách hàng'].B2.f = ''
  assert.throws(() => validateWorkbook(workbook), /INVALID_CELL/)
  delete workbook.Sheets['Khách hàng'].B2.f
  workbook.Sheets['Khách hàng']['!ref'] = 'A1:J20000'
  assert.throws(() => validateWorkbook(workbook), /CELL_LIMIT/)
})

test('parent watchdog kills a stalled boundary process after parse with no preview output', () => {
  const script = new URL('../scripts/benchmark-import-capacity.mjs', import.meta.url)
  const result = spawnSync(process.execPath, [script.pathname, '--case=watchdog-boundary', '--repetitions=1'], { encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.results[0].observedAsExpected, true)
  assert.equal(report.results[0].trials[0].parsedBeforeKill, true)
  assert.equal(report.results[0].trials[0].previewEmitted, false)
})
