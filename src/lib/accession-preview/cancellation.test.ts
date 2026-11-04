// @vitest-environment node
// Isolate Node's rejection handling while executing the actual helper's transpiled source.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { awaitPreviewOperation } from './cancellation'

describe('preview cancellation admission', () => {
    it('does not dispatch a lazy RPC when admission has already expired', async () => {
        let started = false
        const operation = { then: () => { started = true; throw new Error('LAZY_RPC_STARTED') } }
        await expect(awaitPreviewOperation(operation, undefined, performance.now() - 1)).rejects.toThrow('ACCESSION_PREVIEW_DEADLINE')
        await Promise.resolve()
        expect(started).toBe(false)
    })
    it.each(['deadline', 'signal'])('observes eager promise rejection after expired %s admission', mode => {
        const child = spawnSync(process.execPath, ['-e', `
            const fs = require('node:fs'), ts = require('typescript')
            const compiled = ts.transpileModule(fs.readFileSync(process.argv[1], 'utf8'), {
                compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
            }).outputText
            const loaded = {}
            new Function('exports', compiled)(loaded)
            const unhandled = []
            process.on('unhandledRejection', error => unhandled.push(error.message))
            ;(async () => {
                const signal = AbortSignal.abort()
                const rejected = Promise.reject(new Error('SYNTHETIC_OPERATION_REJECTED'))
                let admissionRejected = false
                try {
                    await loaded.awaitPreviewOperation(rejected, process.argv[2] === 'signal' ? signal : undefined, performance.now() - 1)
                } catch { admissionRejected = true }
                await new Promise(resolve => setImmediate(resolve))
                process.stdout.write(JSON.stringify({ admissionRejected, unhandled }))
            })().catch(error => { process.stderr.write(error.message); process.exitCode = 1 })
        `, fileURLToPath(new URL('./cancellation.ts', import.meta.url)), mode], { encoding: 'utf8', timeout: 10000 })
        expect(child.status, child.stderr).toBe(0)
        expect(JSON.parse(child.stdout)).toEqual({ admissionRejected: true, unhandled: [] })
    })
})
