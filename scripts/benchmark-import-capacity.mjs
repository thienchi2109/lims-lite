// Reproducible synthetic CLI benchmark; temporary workbooks are deleted in finally.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir, cpus, totalmem, availableParallelism } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { makeFixture, preflight, parseWorkbook, validateWorkbook, buildPreview, LIMITS, XLSX, typescriptVersion } from './import-capacity-prototype.mjs'

const script = fileURLToPath(import.meta.url)
const budgets = { parseMs: 2000, validateMs: 1000, previewMs: 1000, totalMs: 4000, maxRssMiB: 512, watchdogMs: 30000, oldSpaceMiB: 384 }
const boundary = { clients: 500, samples: 1000, assignments: 20000 }
export const cases = [
  { name: 'normal', clients: 10, samples: 20, assignments: 100 },
  { name: 'clients-boundary', clients: 500, samples: 500, assignments: 500 },
  { name: 'samples-boundary', clients: 10, samples: 1000, assignments: 1000 },
  { name: 'assignments-boundary', clients: 10, samples: 1000, assignments: 20000 },
  { name: 'combined-boundary', ...boundary },
  ...['clients', 'samples', 'assignments'].map((key) => ({ name: key + '-over', ...boundary, [key]: boundary[key] + 1, expected: 'COUNT_LIMIT' })),
  { name: 'invalid-last-boundary', ...boundary, fault: 'last-reference', expected: 'INVALID_ASSIGNMENT' },
  { name: 'compressible-padding', ...boundary, paddingChars: 8000000 },
  { name: 'entropy-padding', ...boundary, paddingChars: 8000000, entropy: true },
  { name: 'file-over', ...boundary, paddingChars: 11000000, entropy: true, expected: 'FILE_LIMIT' },
  { name: 'inflated-over', ...boundary, paddingChars: 34000000, expected: 'INFLATED_LIMIT' },
  { name: 'entries-over', ...boundary, extraEntries: 260, expected: 'ENTRY_LIMIT' },
  { name: 'watchdog-boundary', ...boundary, stall: true, timeout: 2000, expected: 'WATCHDOG' },
]

const mib = (bytes) => Math.round(bytes / 1048576 * 100) / 100
function child(file, stall) {
  const bytes = readFileSync(file), timings = {}, memory = {}
  let stage, zip, previewBytes, counts
  function measure(name, action) {
    stage = name
    const start = performance.now()
    try { return action() } finally {
      timings[name + 'Ms'] = Math.round((performance.now() - start) * 100) / 100
      const snapshot = process.memoryUsage()
      memory[name] = { rssMiB: mib(snapshot.rss), heapUsedMiB: mib(snapshot.heapUsed), externalMiB: mib(snapshot.external) }
    }
  }
  let outcome = 'ACCEPTED'
  try {
    zip = measure('preflight', () => preflight(bytes))
    const workbook = measure('parse', () => parseWorkbook(bytes))
    if (stall) { process.stderr.write('PARSE_COMPLETED\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, budgets.watchdogMs) }
    const validated = measure('validate', () => validateWorkbook(workbook))
    measure('preview', () => {
      const preview = buildPreview(validated)
      previewBytes = Buffer.byteLength(JSON.stringify(preview))
      counts = preview.counts
    })
  } catch (error) {
    outcome = /^(FILE_LIMIT|INFLATED_LIMIT|ENTRY_LIMIT|CELL_LIMIT|COUNT_LIMIT|ZIP_INVALID|INVALID_[A-Z_]+|DUPLICATE_[A-Z_]+|ORPHAN_ROW)$/.test(error.message) ? error.message : 'UNEXPECTED_ERROR'
  }
  const cpu = process.cpuUsage()
  process.stdout.write(JSON.stringify({ outcome, stage, zip, timings, memory, counts, previewBytes, maxRssMiB: mib(process.resourceUsage().maxRSS * 1024), cpuMs: Math.round((cpu.user + cpu.system) / 1000) }))
}

function main() {
  const option = (key) => process.argv.find((value) => value.startsWith('--' + key + '='))?.split('=').slice(1).join('=')
  const repetitions = Number(option('repetitions') || 3)
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) throw new Error('repetitions must be 1..10')
  const selected = cases.filter((item) => !option('case') || item.name === option('case'))
  if (!selected.length) throw new Error('unknown case')
  const directory = mkdtempSync(join(tmpdir(), 'lims-import-capacity-')), results = []
  try {
    for (const item of selected) {
      const file = join(directory, 'synthetic.xlsx')
      const fixture = makeFixture(item)
      writeFileSync(file, fixture, { mode: 0o600 })
      let zip
      try { zip = preflight(fixture, { ...LIMITS, fileBytes: 100000000, inflatedBytes: 100000000, entries: 1000 }) } catch { zip = { fileBytes: fixture.length } }
      const trials = []
      for (let i = 0; i < repetitions; i++) {
        const start = performance.now()
        const result = spawnSync(process.execPath, ['--max-old-space-size=' + budgets.oldSpaceMiB, script, '--child', file, ...(item.stall ? ['--stall'] : [])], { encoding: 'utf8', timeout: item.timeout || budgets.watchdogMs, killSignal: 'SIGKILL', maxBuffer: 100000 })
        if (result.error?.code === 'ETIMEDOUT') trials.push({ outcome: 'WATCHDOG', parsedBeforeKill: result.stderr.includes('PARSE_COMPLETED'), previewEmitted: Boolean(result.stdout) })
        else if (result.status !== 0) trials.push({ outcome: 'PROCESS_FAILED', signal: result.signal, exitCode: result.status })
        else { try { trials.push(JSON.parse(result.stdout)) } catch { trials.push({ outcome: 'INVALID_CHILD_OUTPUT' }) } }
        trials.at(-1).wallMs = Math.round(performance.now() - start)
      }
      const expected = item.expected || 'ACCEPTED'
      const observedAsExpected = trials.every((trial) => trial.outcome === expected && (expected !== 'WATCHDOG' || trial.parsedBeforeKill && !trial.previewEmitted))
      const withinLocalBudgets = trials.every((trial) => trial.outcome !== 'ACCEPTED' || trial.maxRssMiB <= budgets.maxRssMiB && ['parseMs', 'validateMs', 'previewMs'].every((key) => trial.timings[key] <= budgets[key]) && trial.timings.parseMs + trial.timings.validateMs + trial.timings.previewMs <= budgets.totalMs)
      results.push({ case: item, zip, expected, observedAsExpected, withinLocalBudgets, trials })
      process.stderr.write(item.name + ': ' + (observedAsExpected && withinLocalBudgets ? 'PASS_LOCAL' : 'FAIL_LOCAL') + '\n')
    }
  } finally { rmSync(directory, { recursive: true, force: true }) }
  const report = { evidence: 'LOCAL_PROTOTYPE_ONLY', generatedAt: new Date().toISOString(), environment: { node: process.version, sheetjs: XLSX.version, typescript: typescriptVersion, os: process.platform, arch: process.arch, cpu: cpus()[0]?.model, logicalCpus: cpus().length, availableParallelism: availableParallelism(), hostMemoryMiB: mib(totalmem()) }, budgets, limits: LIMITS, repetitions, results }
  // One trial per line keeps machine-readable evidence compact without dropping samples.
  const output = JSON.stringify({ ...report, results: undefined }, null, 2).slice(0, -2) + ',\n  "results": [\n' + results.map(({ trials, ...result }) => '    ' + JSON.stringify(result).slice(0, -1) + ',"trials":[\n' + trials.map((trial) => '      ' + JSON.stringify(trial)).join(',\n') + '\n    ]}').join(',\n') + '\n  ]\n}\n'
  if (option('output')) writeFileSync(option('output'), output)
  else process.stdout.write(output)
  if (results.some((result) => !result.observedAsExpected || !result.withinLocalBudgets)) process.exitCode = 1
}

if (process.argv.includes('--child')) child(process.argv[process.argv.indexOf('--child') + 1], process.argv.includes('--stall'))
else if (process.argv[1] === script) main()
