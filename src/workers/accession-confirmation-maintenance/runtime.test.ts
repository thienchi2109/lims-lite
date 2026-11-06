// @vitest-environment node
// SOURCE ONLY: exercise the one-shot runtime with a fake PG client, never main or a database.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import { Client } from 'pg'

const fake = vi.hoisted(() => ({
    connect: vi.fn(), query: vi.fn(), end: vi.fn(), password: vi.fn(), client: vi.fn(),
}))
vi.mock('pg', () => ({ Client: fake.client }))
vi.mock('node:fs', async (original) => ({
    ...await original<typeof import('node:fs')>(), readFileSync: fake.password,
}))

const validEnvironment = () => ({
    ACCESSION_MAINTENANCE_ENABLED: 'true',
    ACCESSION_MAINTENANCE_POLICY_ID: 'task7-authorized-measurement-fixture',
    ACCESSION_MAINTENANCE_DATABASE_OPERATION_TIMEOUT_MS: '1234',
    ACCESSION_MAINTENANCE_DATABASE_HOST: 'synthetic.invalid',
    ACCESSION_MAINTENANCE_DATABASE_PORT: '5432',
    ACCESSION_MAINTENANCE_DATABASE_NAME: 'synthetic_disposable_only',
    ACCESSION_MAINTENANCE_DATABASE_USER: 'accession_maintenance_worker',
    ACCESSION_MAINTENANCE_DATABASE_PASSWORD_FILE: '/synthetic/password',
})

type Runtime = {
    parseAccessionMaintenanceConfig: (environment: Record<string, string | undefined>) => unknown
    runAccessionMaintenanceRuntime: (environment: Record<string, string | undefined>) => Promise<unknown>
}
async function loadRuntime(): Promise<Runtime> {
    expect(readFileSync).toBe(fake.password)
    expect(Client).toBe(fake.client)
    expect(existsSync('src/workers/accession-confirmation-maintenance/runtime.ts'),
        'one-shot maintenance runtime has not been implemented').toBe(true)
    return await vi.importActual<Runtime>('./runtime')
}

beforeEach(() => {
    vi.clearAllMocks()
    fake.password.mockReturnValue('synthetic-secret\n')
    fake.connect.mockResolvedValue(undefined)
    fake.end.mockResolvedValue(undefined)
    fake.query.mockResolvedValue({ rows: [{ outcome: { state: 'idle' } }] })
    fake.client.mockImplementation(function () {
        return Object.assign(new EventEmitter(), { connect: fake.connect, query: fake.query, end: fake.end })
    })
})

describe('maintenance configuration fails closed before connection', () => {
    it.each([undefined, 'false'])('stays disabled with enabled=%s and no database configuration', async (enabled) => {
        const runtime = await loadRuntime()
        await expect(runtime.runAccessionMaintenanceRuntime({ ACCESSION_MAINTENANCE_ENABLED: enabled }))
            .resolves.toEqual({ state: 'disabled' })
        expect(fake.password).not.toHaveBeenCalled()
        expect(fake.client).not.toHaveBeenCalled()
    })
    it.each([
        ['ACCESSION_MAINTENANCE_ENABLED', 'yes'],
        ['ACCESSION_MAINTENANCE_POLICY_ID', undefined],
        ['ACCESSION_MAINTENANCE_POLICY_ID', '  '],
        ['ACCESSION_MAINTENANCE_DATABASE_OPERATION_TIMEOUT_MS', undefined],
        ['ACCESSION_MAINTENANCE_DATABASE_OPERATION_TIMEOUT_MS', '0'],
        ['ACCESSION_MAINTENANCE_DATABASE_OPERATION_TIMEOUT_MS', '-1'],
        ['ACCESSION_MAINTENANCE_DATABASE_OPERATION_TIMEOUT_MS', '1.5'],
        ['ACCESSION_MAINTENANCE_DATABASE_OPERATION_TIMEOUT_MS', '2147483648'],
        ['ACCESSION_MAINTENANCE_DATABASE_HOST', undefined],
        ['ACCESSION_MAINTENANCE_DATABASE_PORT', undefined],
        ['ACCESSION_MAINTENANCE_DATABASE_PORT', '65536'],
        ['ACCESSION_MAINTENANCE_DATABASE_NAME', undefined],
        ['ACCESSION_MAINTENANCE_DATABASE_USER', 'postgres'],
        ['ACCESSION_MAINTENANCE_DATABASE_USER', 'service_role'],
        ['ACCESSION_MAINTENANCE_DATABASE_USER', 'approval_batch_worker'],
        ['ACCESSION_MAINTENANCE_DATABASE_PASSWORD_FILE', undefined],
        ['ACCESSION_MAINTENANCE_DATABASE_PASSWORD', 'forbidden-inline-secret'],
    ])('rejects invalid %s=%s before creating a client', async (key, value) => {
        const runtime = await loadRuntime()
        await expect(runtime.runAccessionMaintenanceRuntime({ ...validEnvironment(), [key]: value })).rejects.toThrow()
        expect(fake.client).not.toHaveBeenCalled()
    })
    it('rejects an empty protected credential before creating a client', async () => {
        const runtime = await loadRuntime()
        fake.password.mockReturnValue(' \n')
        await expect(runtime.runAccessionMaintenanceRuntime(validEnvironment())).rejects.toThrow()
        expect(fake.client).not.toHaveBeenCalled()
    })
})

describe('one-shot maintenance reconciliation', () => {
    it('calls only the maintenance RPC once and closes the client', async () => {
        const runtime = await loadRuntime()
        await expect(runtime.runAccessionMaintenanceRuntime(validEnvironment())).resolves.toEqual({ state: 'idle' })
        expect(fake.connect).toHaveBeenCalledOnce()
        expect(fake.query).toHaveBeenCalledOnce()
        expect(JSON.stringify(fake.query.mock.calls)).toContain('public.maintain_accession_import_once()')
        expect(JSON.stringify(fake.query.mock.calls)).not.toMatch(/confirm_accession_import|INSERT|UPDATE|DELETE/i)
        expect(fake.end).toHaveBeenCalledOnce()
        expect(fake.client).toHaveBeenCalledWith(expect.objectContaining({
            user: 'accession_maintenance_worker', password: 'synthetic-secret',
            connectionTimeoutMillis: 1234, query_timeout: 1234, statement_timeout: 1234,
        }))
    })
    it('returns validated safe maintenance counts', async () => {
        const runtime = await loadRuntime()
        const outcome = { state: 'maintained', recovered: true, expired: false, purgedBindings: 3 }
        fake.query.mockResolvedValue({ rows: [{ outcome }] })
        await expect(runtime.runAccessionMaintenanceRuntime(validEnvironment())).resolves.toEqual(outcome)
        expect(fake.end).toHaveBeenCalledOnce()
    })
    it.each(['connect', 'query'])('closes after %s outage and does not claim success or replay', async (operation) => {
        const runtime = await loadRuntime()
        fake[operation as 'connect' | 'query'].mockRejectedValue(new Error('synthetic-private-payload'))
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
            await expect(runtime.runAccessionMaintenanceRuntime(validEnvironment())).rejects.toThrow()
            expect(fake.query.mock.calls.length).toBeLessThanOrEqual(1)
            expect(fake.end).toHaveBeenCalledOnce()
            expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('synthetic-private-payload')
        } finally { errorSpy.mockRestore() }
    })
    it('restarts with a fresh single maintenance reconciliation after an uncertain outage', async () => {
        const runtime = await loadRuntime()
        fake.query.mockRejectedValueOnce(new Error('lost result'))
        await expect(runtime.runAccessionMaintenanceRuntime(validEnvironment())).rejects.toThrow()
        fake.query.mockResolvedValueOnce({ rows: [{ outcome: { state: 'idle' } }] })
        await expect(runtime.runAccessionMaintenanceRuntime(validEnvironment())).resolves.toEqual({ state: 'idle' })
        expect(fake.client).toHaveBeenCalledTimes(2)
        expect(fake.query).toHaveBeenCalledTimes(2)
        expect(fake.end).toHaveBeenCalledTimes(2)
        expect(JSON.stringify(fake.query.mock.calls)).not.toContain('confirm_accession_import')
    })
    it('handles native PG error events without exposing an uncaught payload or claiming success', async () => {
        const runtime = await loadRuntime()
        let fail: ((reason: Error) => void) | undefined
        fake.query.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
        const running = runtime.runAccessionMaintenanceRuntime(validEnvironment())
        await vi.waitFor(() => expect(fake.query).toHaveBeenCalledOnce())
        let uncaught: unknown
        try { fake.client.mock.results[0].value.emit('error', new Error('synthetic-private-payload')) }
        catch (error) { uncaught = error }
        fail?.(new Error('synthetic-private-payload'))
        await expect(running).rejects.toThrow()
        expect(uncaught).toBeUndefined()
        expect(fake.end).toHaveBeenCalledOnce()
    })
    it('drains one in-flight RPC on interruption without a second call', async () => {
        const runtime = await loadRuntime()
        let settle: ((value: unknown) => void) | undefined
        fake.query.mockImplementationOnce(() => new Promise((resolve) => { settle = resolve }))
        const signalListeners = process.listenerCount('SIGTERM')
        const running = runtime.runAccessionMaintenanceRuntime(validEnvironment())
        await vi.waitFor(() => expect(fake.query).toHaveBeenCalledOnce())
        process.emit('SIGTERM')
        settle?.({ rows: [{ outcome: { state: 'idle' } }] })
        await expect(running).rejects.toThrow()
        expect(fake.query).toHaveBeenCalledOnce()
        expect(fake.end).toHaveBeenCalledOnce()
        expect(process.listenerCount('SIGTERM')).toBe(signalListeners)
    })
    it.each([
        undefined, { state: 'succeeded' }, { state: 'maintained', recovered: true, expired: false, purgedBindings: -1 },
        { state: 'idle', payload: 'must-not-escape' },
    ])('rejects malformed or overbroad RPC outcome %j and closes', async (outcome) => {
        const runtime = await loadRuntime()
        fake.query.mockResolvedValue({ rows: [{ outcome }] })
        await expect(runtime.runAccessionMaintenanceRuntime(validEnvironment())).rejects.toThrow()
        expect(fake.end).toHaveBeenCalledOnce()
    })
})
