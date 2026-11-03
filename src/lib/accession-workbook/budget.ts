// Trusted caller-owned defensive budgets. No business count limits or production defaults.
import 'server-only'
import { performance } from 'node:perf_hooks'
import { setImmediate } from 'node:timers/promises'

export type WorkbookResources = {
    maxInflatedBytes: number; maxEntries: number; maxCells: number
    maxXmlDepth: number; maxXmlTextBytes: number; maxRetainedBytes: number; maxElapsedMs: number
}
const keys: (keyof WorkbookResources)[] = ['maxInflatedBytes', 'maxEntries', 'maxCells', 'maxXmlDepth', 'maxXmlTextBytes', 'maxRetainedBytes', 'maxElapsedMs']

export class WorkbookBudget {
    readonly limits: Readonly<WorkbookResources>
    readonly deadline: number
    private retained = 0
    private inflated = 0
    private cells = 0

    constructor(input: WorkbookResources) {
        if (!input || keys.some(key => !Number.isSafeInteger(input[key]) || input[key] < 1)) throw new Error('RESOURCE_POLICY_INVALID')
        this.limits = Object.freeze(Object.fromEntries(keys.map(key => [key, input[key]]))) as WorkbookResources
        this.deadline = performance.now() + this.limits.maxElapsedMs
    }

    check(): void {
        if (performance.now() >= this.deadline) throw new Error('RESOURCE_LIMIT')
    }

    reserve(bytes: number): void {
        this.check()
        if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.limits.maxRetainedBytes - this.retained) throw new Error('RESOURCE_LIMIT')
        this.retained += bytes
    }

    release(bytes: number): void { this.retained -= bytes }

    inflate(bytes: number): void {
        this.check()
        if (bytes > this.limits.maxInflatedBytes - this.inflated) throw new Error('RESOURCE_LIMIT')
        this.inflated += bytes
    }

    cell(): void {
        this.check()
        if (++this.cells > this.limits.maxCells) throw new Error('RESOURCE_LIMIT')
    }

    async yield(): Promise<void> {
        await setImmediate()
        this.check()
    }
}
