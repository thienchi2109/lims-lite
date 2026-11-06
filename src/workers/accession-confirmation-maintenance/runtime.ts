/**
 * Opt-in, one-shot import maintenance; PostgreSQL owns lock/state reconciliation.
 * Timing policy is required explicitly; credentials come only from a protected file.
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { z } from 'zod'

const Configuration = z.object({
    policyId: z.string().trim().min(1),
    operationTimeoutMs: z.coerce.number().int().positive().max(2_147_483_647),
    host: z.string().trim().min(1),
    port: z.coerce.number().int().min(1).max(65_535),
    database: z.string().trim().min(1),
    user: z.literal('accession_maintenance_worker'),
    passwordFile: z.string().trim().min(1),
})
const Outcome = z.discriminatedUnion('state', [
    z.object({ state: z.literal('idle') }).strict(),
    z.object({
        state: z.literal('maintained'), recovered: z.boolean(), expired: z.boolean(),
        purgedBindings: z.number().int().nonnegative(),
    }).strict(),
])

export function parseAccessionMaintenanceConfig(environment: NodeJS.ProcessEnv = process.env) {
    const enabled = z.enum(['true', 'false']).optional().parse(environment.ACCESSION_MAINTENANCE_ENABLED)
    if (enabled !== 'true') return null
    if (environment.ACCESSION_MAINTENANCE_DATABASE_PASSWORD !== undefined) {
        throw new Error('Maintenance credentials require a protected password file')
    }
    const config = Configuration.parse({
        policyId: environment.ACCESSION_MAINTENANCE_POLICY_ID,
        operationTimeoutMs: environment.ACCESSION_MAINTENANCE_DATABASE_OPERATION_TIMEOUT_MS,
        host: environment.ACCESSION_MAINTENANCE_DATABASE_HOST,
        port: environment.ACCESSION_MAINTENANCE_DATABASE_PORT,
        database: environment.ACCESSION_MAINTENANCE_DATABASE_NAME,
        user: environment.ACCESSION_MAINTENANCE_DATABASE_USER,
        passwordFile: environment.ACCESSION_MAINTENANCE_DATABASE_PASSWORD_FILE,
    })
    const password = readFileSync(config.passwordFile, 'utf8').trim()
    if (!password) throw new Error('Maintenance password file must contain a credential')
    return { ...config, password }
}

export async function runAccessionMaintenanceRuntime(environment: NodeJS.ProcessEnv = process.env) {
    const config = parseAccessionMaintenanceConfig(environment)
    if (!config) return { state: 'disabled' as const }
    const client = new Client({
        application_name: 'accession-confirmation-maintenance',
        host: config.host, port: config.port, database: config.database,
        user: config.user, password: config.password,
        connectionTimeoutMillis: config.operationTimeoutMs,
        query_timeout: config.operationTimeoutMs, statement_timeout: config.operationTimeoutMs,
    })
    let interrupted = false
    const interrupt = () => { interrupted = true }
    client.on('error', interrupt) // Handle driver errors without Node printing raw database messages.
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, interrupt)
    try {
        await client.connect()
        if (interrupted) throw new Error('Maintenance interrupted before dispatch')
        // ponytail: one candidate per invocation; add a measured external schedule after TASK-7 release.
        const result = await client.query('SELECT public.maintain_accession_import_once() AS outcome')
        if (interrupted) throw new Error('Maintenance interrupted; reconcile on the next invocation')
        return Outcome.parse(result.rows[0]?.outcome)
    } finally {
        for (const signal of ['SIGINT', 'SIGTERM'] as const) process.removeListener(signal, interrupt)
        await client.end()
    }
}
