// Request-local verification; atomic confirmation revalidates this handoff under database locks.
import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { readTemplateSigningConfig } from '@/lib/accession-template/binding'
import { authorityDigest, catalogDigest, snapshotCatalogs, validateTemplateSnapshot } from '@/lib/accession-template/contract'
import { validateAccessionWorkbook } from '@/lib/accession-workbook/validate'
import { resolveAccessionPreviewClients } from './clients'
import { canonicalizeAccessionIntent } from './intent'
import { buildBindings, digestBindingSet, readPreviewConfiguration } from './server'
import { accessionReceiptSchema } from './http-contract'
export { accessionReceiptSchema } from './http-contract'

const loadedSchema = z.object({ batch: z.object({ id: z.string().uuid(), owner_id: z.string().uuid(),
    state: z.literal('preview_ready'), expires_at: z.string().datetime({ offset: true }) }).passthrough(),
    bindings: z.array(z.array(z.unknown())).min(1) })
const sha256 = (input: string | Uint8Array) => createHash('sha256').update(input).digest('hex')
function unavailable(): never { throw new Error('ACCESSION_CONFIRMATION_UNAVAILABLE') }
export class ConfirmationPreparationFailure extends Error {
    constructor(public readonly actorId: string, public readonly batchId: string, public readonly reasonCode:
        'PREVIEW_CONTENT_CHANGED' | 'AUTHORITY_CHANGED' | 'ATTESTATION_REQUIRED' | 'CONFIGURATION_UNAVAILABLE', message: string) { super(message) }
}

export async function prepareAccessionConfirmation(batchId: string, source?: Uint8Array, acceptableQuality?: boolean) {
    const actor = await requireRole('analyst')
    if (isAuthError(actor) || actor.role !== 'analyst') throw new Error('ACCESSION_CONFIRMATION_FORBIDDEN')
    z.string().uuid().parse(batchId)
    // This protected reader checks service caller, current active actor and batch ownership in SQL.
    const loaded = await createAdminClient().rpc('get_accession_confirmation_preparation', { p_actor: actor.id, p_batch: batchId })
    if (loaded.error) unavailable()
    if (loaded.data && typeof loaded.data === 'object' && 'receipt' in loaded.data) {
        const parsed = accessionReceiptSchema.safeParse(loaded.data.receipt)
        if (!parsed.success || parsed.data.batch_id !== batchId || parsed.data.owner_id !== actor.id
            || parsed.data.client_count !== parsed.data.create_count + parsed.data.reuse_count) unavailable()
        return { kind: 'receipt' as const, receipt: parsed.data }
    }
    const protectedData = loadedSchema.safeParse(loaded.data)
    if (!protectedData.success || protectedData.data.batch.id !== batchId || protectedData.data.batch.owner_id !== actor.id) unavailable()
    if (acceptableQuality !== true) throw new ConfirmationPreparationFailure(actor.id,batchId,'ATTESTATION_REQUIRED','ACCESSION_CONFIRMATION_ATTESTATION_REQUIRED')
    if (!(source instanceof Uint8Array) || source.byteLength < 1 || source.byteLength >= 10000000) throw new ConfirmationPreparationFailure(actor.id,batchId,'PREVIEW_CONTENT_CHANGED','ACCESSION_CONFIRMATION_SOURCE_INVALID')
    try {
        const { batch, bindings: sealed } = protectedData.data
        const bytes = Buffer.from(source)
        if (batch.source_sha256 !== sha256(bytes) || batch.source_size !== bytes.length) unavailable()
        const config = readPreviewConfiguration(), signingConfig = readTemplateSigningConfig()
        const authority = await (await createClient()).rpc('get_accession_template_snapshot')
        if (authority.error) unavailable()
        const snapshot = validateTemplateSnapshot(authority.data)
        const parsed = await validateAccessionWorkbook(bytes, { snapshot, signingConfig, resources: config.policy.resources })
        if (!parsed.ok) unavailable()
        const workbook = parsed.value, plan = await resolveAccessionPreviewClients(workbook)
        if (!plan.ok) unavailable()
        const intent = canonicalizeAccessionIntent(workbook, plan.clients)
        const retained = new Map<number, string>()
        for (const binding of sealed) {
            if (binding.length !== 11) unavailable()
            if (binding[0] === 'client') {
                if (!Number.isSafeInteger(binding[1]) || typeof binding[9] !== 'string' || retained.has(binding[1] as number)) unavailable()
                retained.set(binding[1] as number, binding[9])
            }
        }
        const binding = buildBindings(batchId, workbook, plan.clients, snapshot, config, retained)
        if (binding.canonical !== digestBindingSet(sealed).canonical) unavailable()
        const metadata = { source_sha256: sha256(bytes), source_size: bytes.length,
            normalized_payload_hash: intent.normalizedPayloadHash, canonicalization_version: intent.canonicalizationVersion,
            template_version: workbook.template.version, template_digest: authorityDigest(snapshot),
            template_claims_digest: sha256(JSON.stringify(workbook.template)), catalog_digest: catalogDigest(snapshotCatalogs(snapshot)),
            revision: snapshot.revisionNumber, validation_version: 'accession-workbook-v1', resolver_version: 'accession-preview-clients-v1',
            binding_set_digest: binding.digest, client_count: workbook.clients.length, sample_count: workbook.samples.length,
            assignment_count: workbook.assignments.length, create_count: plan.clients.filter(client => client.disposition === 'create').length,
            reuse_count: plan.clients.filter(client => client.disposition === 'reuse').length }
        if (Object.entries(metadata).some(([key, value]) => batch[key] !== value)) unavailable()
        const clients = workbook.clients.map(client => ({ row: client.callerContext.row, name: client.name, dateOfBirth: client.dateOfBirth,
            governmentIdentityType: client.governmentIdentityType, governmentIdentityValue: client.governmentIdentityValue,
            gender: client.gender, phone: client.phone, address: client.address, healthInsuranceNum: client.healthInsuranceNum, expiryDate: client.expiryDate }))
        const expectedClients = plan.clients.map(({ row, input, resolution, trustedIdentity, displayValues, issues }) => ({ row, input, resolution, trustedIdentity, displayValues, issues }))
        // Acceptance time belongs to the later locked transaction, never the application clock.
        return { kind: 'prepared' as const, actorId: actor.id, batchId, attested: true as const, workbook, snapshot,
            clients, expectedClients, canonicalIntent: intent.canonicalJson, bindingsText: binding.canonical, metadata }
    } catch (error) {
        const reason = error instanceof Error && /CONFIGURATION_UNAVAILABLE$/.test(error.message)
            ? 'CONFIGURATION_UNAVAILABLE' : 'PREVIEW_CONTENT_CHANGED'
        throw new ConfirmationPreparationFailure(actor.id,batchId,reason,'ACCESSION_CONFIRMATION_UNAVAILABLE')
    }
}
