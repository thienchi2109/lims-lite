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

test('exact count boundary succeeds, each independent +1 rejects the whole preview', () => {
  assert.deepEqual(buildPreview(prepare(LIMITS)).counts, { clients: 500, samples: 1000, assignments: 20000 })
  for (const key of ['clients', 'samples', 'assignments']) {
    assert.throws(() => prepare({ ...LIMITS, [key]: LIMITS[key] + 1 }), /COUNT_LIMIT/)
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
