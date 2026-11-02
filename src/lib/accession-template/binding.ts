// Stateless HMAC binding; keys and authenticated claims never cross a client boundary.
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import {
    authorityDigest, catalogDigest, METADATA_HEADERS, METADATA_KEYS, positiveBigint,
    snapshotCatalogs, TEMPLATE_ID, TEMPLATE_VERSION, validGeneratedAt, validateTemplateSnapshot,
} from './contract'

const keyId = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/)
const signingSchema = z.object({
    activeKeyId: keyId,
    keys: z.record(keyId, z.string().regex(/^[0-9a-fA-F]{64}$/)),
}).strict()
export type TemplateSigningConfig = z.infer<typeof signingSchema>

function validateSigningConfig(input: unknown): TemplateSigningConfig {
    const parsed = signingSchema.safeParse(input)
    if (!parsed.success || !Object.hasOwn(parsed.data.keys, parsed.data.activeKeyId)) throw new Error('ACCESSION_TEMPLATE_CONFIGURATION_UNAVAILABLE')
    return parsed.data
}

// Runtime policy: one active signing key; configured retained keys remain verifiable.
// Removing a key retires it. Secrets are exactly 32 random bytes encoded as hex.
export function readTemplateSigningConfig(env: NodeJS.ProcessEnv = process.env): TemplateSigningConfig {
    try {
        return validateSigningConfig({ activeKeyId: env.ACCESSION_TEMPLATE_SIGNING_KEY_ID, keys: JSON.parse(env.ACCESSION_TEMPLATE_SIGNING_KEYS ?? '') })
    } catch { throw new Error('ACCESSION_TEMPLATE_CONFIGURATION_UNAVAILABLE') }
}

const claimsSchema = z.tuple([
    z.literal('accession-template-binding'), z.literal(1), z.literal(TEMPLATE_ID), z.literal(TEMPLATE_VERSION),
    z.string().refine(validGeneratedAt), positiveBigint,
    z.string().regex(/^[0-9a-f]{64}$/), z.string().regex(/^[0-9a-f]{64}$/),
])
export type TemplateClaims = {
    templateId: typeof TEMPLATE_ID
    version: typeof TEMPLATE_VERSION
    generatedAt: string
    revision: string
    authorityDigest: string
    catalogDigest: string
}

export function createTemplateBinding(snapshotInput: unknown, configInput: unknown, generatedAt: string): string[][] {
    const snapshot = validateTemplateSnapshot(snapshotInput)
    const config = validateSigningConfig(configInput)
    if (!validGeneratedAt(generatedAt)) throw new Error('TEMPLATE_METADATA_INVALID')
    const claims = [
        'accession-template-binding', 1, TEMPLATE_ID, TEMPLATE_VERSION, generatedAt, snapshot.revisionNumber,
        authorityDigest(snapshot), catalogDigest(snapshotCatalogs(snapshot)),
    ]
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
    const content = `${config.activeKeyId}.${payload}`
    const mac = createHmac('sha256', Buffer.from(config.keys[config.activeKeyId], 'hex')).update(content).digest('base64url')
    const descriptor = `${content}.${mac}`
    if (descriptor.length > 2048) throw new Error('TEMPLATE_METADATA_INVALID')
    const values = [TEMPLATE_ID, TEMPLATE_VERSION, generatedAt, snapshot.revisionNumber, descriptor]
    return [[...METADATA_HEADERS], ...METADATA_KEYS.map((key, index) => [key, values[index]])]
}

function authenticateDescriptor(descriptor: string, config: TemplateSigningConfig): TemplateClaims {
    if (descriptor.length > 2048) throw new Error('TEMPLATE_METADATA_INVALID')
    const parts = descriptor.split('.')
    if (parts.length !== 3 || !keyId.safeParse(parts[0]).success || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2]) || !Object.hasOwn(config.keys, parts[0])) throw new Error('TEMPLATE_METADATA_INVALID')
    const [id, payload, signature] = parts
    const supplied = Buffer.from(signature, 'base64url')
    const expected = createHmac('sha256', Buffer.from(config.keys[id], 'hex')).update(`${id}.${payload}`).digest()
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected) || supplied.toString('base64url') !== signature) throw new Error('TEMPLATE_METADATA_INVALID')
    // Only authenticated bytes may become claims. Reject noncanonical base64url too.
    const bytes = Buffer.from(payload, 'base64url')
    if (bytes.toString('base64url') !== payload) throw new Error('TEMPLATE_METADATA_INVALID')
    let parsed: z.infer<typeof claimsSchema>
    try { parsed = claimsSchema.parse(JSON.parse(bytes.toString('utf8'))) }
    catch { throw new Error('TEMPLATE_METADATA_INVALID') }
    return { templateId: parsed[2], version: parsed[3], generatedAt: parsed[4], revision: parsed[5], authorityDigest: parsed[6], catalogDigest: parsed[7] }
}

// Parser handoff: pass literal string matrices, including original catalog/header rows.
// This authenticates binding/current authority; structural/business parsing is separate.
export function verifyTemplateBinding(metadataInput: unknown, catalogs: unknown, configInput: unknown, currentSnapshot: unknown): TemplateClaims {
    const config = validateSigningConfig(configInput)
    const parsed = z.array(z.tuple([z.string().max(32767), z.string().max(32767)])).length(6).safeParse(metadataInput)
    if (!parsed.success || JSON.stringify(parsed.data[0]) !== JSON.stringify(METADATA_HEADERS)) throw new Error('TEMPLATE_METADATA_INVALID')
    const rows = parsed.data.slice(1)
    const metadata = new Map(rows)
    if (metadata.size !== 5 || METADATA_KEYS.some(key => !metadata.has(key))) throw new Error('TEMPLATE_METADATA_INVALID')
    const claims = authenticateDescriptor(metadata.get('catalog_binding')!, config)
    if (metadata.get('template_id') !== claims.templateId || metadata.get('template_version') !== claims.version || metadata.get('generated_at') !== claims.generatedAt || metadata.get('compatibility_revision') !== claims.revision || catalogDigest(catalogs) !== claims.catalogDigest) throw new Error('TEMPLATE_METADATA_INVALID')
    if (authorityDigest(validateTemplateSnapshot(currentSnapshot)) !== claims.authorityDigest) throw new Error('CATALOG_STALE')
    return claims
}
