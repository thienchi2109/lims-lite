// Server-only Phase 3 orchestration: request-local source/PII, durable safe commitments only.
import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { z } from 'zod'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { readTemplateSigningConfig } from '@/lib/accession-template/binding'
import { authorityDigest, catalogDigest, snapshotCatalogs, validateTemplateSnapshot } from '@/lib/accession-template/contract'
import { validateAccessionWorkbook, type ValidatedAccessionWorkbook } from '@/lib/accession-workbook/validate'
import { WorkbookBudget } from '@/lib/accession-workbook/budget'
import { resolveAccessionPreviewClients, type PlannedClient } from './clients'
import { PreviewClientRowSchema } from './client-contract'
import { canonicalizeAccessionIntent } from './intent'

const positive = z.number().int().positive().safe()
const keyId = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/)
const configSchema = z.strictObject({
    activeKeyId: keyId, keys: z.record(keyId, z.string().regex(/^[a-fA-F0-9]{64}$/)),
    policy: z.strictObject({ evidenceId: z.string().regex(/^[A-Za-z0-9._:/-]{1,160}$/), leaseMs: positive, heartbeatMs: positive,
        resources: z.strictObject({ maxInflatedBytes: positive, maxEntries: positive, maxCells: positive, maxXmlDepth: positive,
            maxXmlTextBytes: positive, maxRetainedBytes: positive, maxElapsedMs: positive }) }),
}).refine(c => Object.hasOwn(c.keys, c.activeKeyId) && c.policy.heartbeatMs < c.policy.leaseMs
    && c.policy.leaseMs <= 2147483647 && c.policy.heartbeatMs <= 2147483647)
type BindingKeys = { activeKeyId: string; keys: Record<string, string> }
export function readPreviewConfiguration(env: NodeJS.ProcessEnv = process.env) {
    try {
        const config = configSchema.parse({ activeKeyId: env.ACCESSION_PREVIEW_BINDING_KEY_ID,
            keys: JSON.parse(env.ACCESSION_PREVIEW_BINDING_KEYS ?? ''), policy: JSON.parse(env.ACCESSION_PREVIEW_POLICY ?? '') })
        new WorkbookBudget(config.policy.resources)
        return config
    } catch { throw new Error('ACCESSION_PREVIEW_CONFIGURATION_UNAVAILABLE') }
}

const sha256 = (input: string | Uint8Array) => createHash('sha256').update(input).digest('hex')
const fields = (value: Record<string, unknown>) => Object.keys(value).sort().map(key => [key, value[key]])
// Separate key ring from template signing. Retain old versions until referencing previews expire/purge.
export function fingerprintClientBinding(batchId: string, input: unknown, config: BindingKeys) {
    z.string().uuid().parse(batchId)
    const row = PreviewClientRowSchema.parse(input)
    const secret = config.keys[config.activeKeyId]
    if (!keyId.safeParse(config.activeKeyId).success || !/^[a-fA-F0-9]{64}$/.test(secret ?? '')) throw new Error('ACCESSION_PREVIEW_CONFIGURATION_UNAVAILABLE')
    const tuple = [batchId, row.row, row.resolution.outcome, row.resolution.clientId,
        fields(row.input), row.displayValues === null ? null : fields(row.displayValues)]
    return { keyVersion: config.activeKeyId, fingerprint: createHmac('sha256', Buffer.from(secret, 'hex'))
        .update('lims-lite:bulk-accession:client-binding:v1\n' + JSON.stringify(tuple), 'utf8').digest('hex') }
}

// Each durable tuple: kind,row,parentRow,code,UUID,generation,method,outcome,matchedUUID,keyVersion,HMAC.
export function digestBindingSet(bindings: readonly unknown[][]) {
    const canonical = JSON.stringify(bindings.map(binding => JSON.stringify(binding)).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(value => JSON.parse(value)))
    return { canonical, digest: sha256(canonical) }
}

function buildBindings(batchId: string, workbook: ValidatedAccessionWorkbook, clients: PlannedClient[], snapshot: ReturnType<typeof validateTemplateSnapshot>, config: BindingKeys) {
    const bindings: unknown[][] = clients.map(client => {
        const { row, input, resolution, trustedIdentity, displayValues, issues } = client
        const fingerprint = fingerprintClientBinding(batchId, { row, input, resolution, trustedIdentity, displayValues, issues }, config)
        return ['client', client.row, null, null, null, null, null, client.resolution.outcome, client.clientId, fingerprint.keyVersion, fingerprint.fingerprint]
    })
    const clientRows = new Map(workbook.clients.map(client => [client.temporaryReference, client.callerContext.row]))
    const sampleRows = new Map(workbook.samples.map(sample => [sample.temporaryReference, sample.callerContext.row]))
    for (const sample of workbook.samples) {
        const entity = snapshot.sampleTypes.find(type => type.importCode === sample.sampleTypeCode)!
        bindings.push(['sample', sample.callerContext.row, clientRows.get(sample.clientTemporaryReference), entity.importCode, entity.id, entity.compatibilityGeneration, null, null, null, null, null])
    }
    for (const assignment of workbook.assignments) {
        const entity = snapshot.assays.find(assay => assay.importCode === assignment.assayCode)!
        bindings.push(['assignment', assignment.callerContext.row, sampleRows.get(assignment.sampleTemporaryReference), entity.importCode, entity.id, entity.compatibilityGeneration, entity.methodName, null, null, null, null])
    }
    return digestBindingSet(bindings)
}

const batchSchema = z.object({ id: z.string().uuid(), lease_token: z.string().uuid(), lease_generation: positive,
    preview_created_at: z.string().nullable(), expires_at: z.string().nullable() })
const sealedSchema = z.object({ id: z.string().uuid(), preview_created_at: z.string(), expires_at: z.string() })

// Trusted server caller only. Phase 4 owns multipart/HTTP; no body-supplied actor/config.
export async function prepareAccessionPreview(source: Uint8Array, retryOf?: string) {
    const actor = await requireRole('analyst')
    if (isAuthError(actor) || actor.role !== 'analyst') throw new Error('ACCESSION_PREVIEW_FORBIDDEN')
    if (!(source instanceof Uint8Array) || source.byteLength < 1 || source.byteLength >= 10000000) throw new Error('ACCESSION_PREVIEW_SOURCE_INVALID')
    if (retryOf !== undefined) z.string().uuid().parse(retryOf)
    const config = readPreviewConfiguration(), signing = readTemplateSigningConfig()
    const admin = createAdminClient(), user = await createClient()
    const start = await admin.rpc('start_accession_preview', { p_actor: actor.id, p_retry_of: retryOf ?? null,
        p_lease_ms: config.policy.leaseMs, p_policy_evidence: config.policy.evidenceId })
    if (start.error) throw new Error('ACCESSION_PREVIEW_UNAVAILABLE')
    const batch = batchSchema.parse(start.data)
    const fence = { p_actor: actor.id, p_batch: batch.id, p_token: batch.lease_token, p_generation: batch.lease_generation }
    let heartbeatError = false, pending: Promise<void> | undefined
    const heartbeat = async () => {
        try { const result = await admin.rpc('heartbeat_accession_preview', fence); if (result.error) heartbeatError = true }
        catch { heartbeatError = true }
    }
    const timer = setInterval(() => { if (!pending) pending = heartbeat().finally(() => { pending = undefined }) }, config.policy.heartbeatMs)
    const stopHeartbeat = async () => { clearInterval(timer); await pending; if (heartbeatError) throw new Error('ACCESSION_PREVIEW_LEASE_STALE') }
    try {
        const bytes = Buffer.from(source), sourceHash = sha256(bytes)
        const sourceBinding = await admin.rpc('heartbeat_accession_preview', { ...fence, p_source_sha256: sourceHash, p_source_size: bytes.length })
        if (sourceBinding.error) throw new Error('ACCESSION_PREVIEW_LEASE_STALE')
        const authority = await user.rpc('get_accession_template_snapshot')
        if (authority.error) throw new Error('ACCESSION_PREVIEW_AUTHORITY_CHANGED')
        const snapshot = validateTemplateSnapshot(authority.data)
        const parsed = await validateAccessionWorkbook(bytes, { snapshot, signingConfig: signing, resources: config.policy.resources })
        if (!parsed.ok) {
            await stopHeartbeat()
            const rejected = await admin.rpc('finish_accession_preview', { ...fence, p_state: 'rejected', p_reason: 'WORKBOOK_INVALID' })
            if (rejected.error) throw new Error('ACCESSION_PREVIEW_UNAVAILABLE')
            return { ok: false as const, batchId: batch.id, errors: parsed.errors }
        }
        const workbook = parsed.value, plan = await resolveAccessionPreviewClients(workbook)
        if (!plan.ok) {
            await stopHeartbeat()
            const rejected = await admin.rpc('finish_accession_preview', { ...fence, p_state: 'rejected', p_reason: 'CLIENT_INVALID' })
            if (rejected.error) throw new Error('ACCESSION_PREVIEW_UNAVAILABLE')
            return { ok: false as const, batchId: batch.id, errors: plan.errors }
        }
        const intent = canonicalizeAccessionIntent(workbook, plan.clients), binding = buildBindings(batch.id, workbook, plan.clients, snapshot, config)
        const expectedClients = plan.clients.map(({ row, input, resolution, trustedIdentity, displayValues, issues }) => ({ row, input, resolution, trustedIdentity, displayValues, issues }))
        const clientInputs = workbook.clients.map(client => ({ row: client.callerContext.row, name: client.name, dateOfBirth: client.dateOfBirth,
            governmentIdentityType: client.governmentIdentityType, governmentIdentityValue: client.governmentIdentityValue,
            gender: client.gender, phone: client.phone, address: client.address, healthInsuranceNum: client.healthInsuranceNum, expiryDate: client.expiryDate }))
        await stopHeartbeat()
        const sealed = await admin.rpc('seal_accession_preview', { ...fence, p_snapshot: snapshot, p_clients: clientInputs,
            p_expected_clients: expectedClients, p_bindings_text: binding.canonical, p_metadata: {
                source_sha256: sourceHash, source_size: bytes.length, normalized_payload_hash: intent.normalizedPayloadHash,
                canonicalization_version: intent.canonicalizationVersion, template_version: workbook.template.version,
                // Digest authenticated TemplateClaims JSON; source_sha256 binds original descriptor/workbook bytes.
                template_digest: authorityDigest(snapshot), template_claims_digest: sha256(JSON.stringify(workbook.template)),
                catalog_digest: catalogDigest(snapshotCatalogs(snapshot)), revision: snapshot.revisionNumber,
                validation_version: 'accession-workbook-v1', resolver_version: 'accession-preview-clients-v1', binding_set_digest: binding.digest,
                client_count: plan.clients.length, sample_count: workbook.samples.length, assignment_count: workbook.assignments.length,
                create_count: plan.clients.filter(client => client.disposition === 'create').length,
                reuse_count: plan.clients.filter(client => client.disposition === 'reuse').length,
            } })
        if (sealed.error) throw new Error('ACCESSION_PREVIEW_AUTHORITY_CHANGED')
        const committed = sealedSchema.parse(sealed.data)
        return { ok: true as const, batchId: batch.id, previewCreatedAt: committed.preview_created_at, expiresAt: committed.expires_at,
            counts: { clients: plan.clients.length, samples: workbook.samples.length, assignments: workbook.assignments.length }, clients: plan.clients }
    } catch {
        clearInterval(timer); await pending
        // Fenced cleanup cannot rewrite a completed seal after an unknown network outcome.
        try { await admin.rpc('finish_accession_preview', { ...fence, p_state: 'failed', p_reason: 'PREPARATION_FAILED' }) } catch { /* TASK-12 recovers an abandoned lease. */ }
        throw new Error('ACCESSION_PREVIEW_UNAVAILABLE')
    } finally { clearInterval(timer) }
}
