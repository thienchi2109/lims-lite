// Server-only v1 contract: validate the single RPC snapshot and canonical digest inputs.
import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'

export const TEMPLATE_ID = 'lims-bulk-accession'
export const TEMPLATE_VERSION = '1'
export const SHEET_NAMES = ['Hướng dẫn', 'Thông tin template', 'Khách hàng', 'Mẫu', 'Chỉ định', 'Danh mục loại mẫu', 'Danh mục chỉ tiêu', 'Danh mục tương thích'] as const
export const METADATA_HEADERS = ['Thuộc tính', 'Giá trị']
export const METADATA_KEYS = ['template_id', 'template_version', 'generated_at', 'compatibility_revision', 'catalog_binding'] as const
export const BUSINESS_HEADERS = [
    ['Mã khách hàng tạm', 'Họ và tên', 'Ngày sinh', 'Loại giấy tờ', 'Số giấy tờ', 'Giới tính', 'Số điện thoại', 'Địa chỉ', 'Số BHYT', 'Ngày hết hạn BHYT'],
    ['Mã mẫu tạm', 'Mã khách hàng tạm', 'Mã loại mẫu'],
    ['Mã mẫu tạm', 'Mã chỉ tiêu'],
]
export const CATALOG_HEADERS = [['Mã loại mẫu', 'Tên loại mẫu'], ['Mã chỉ tiêu', 'Tên chỉ tiêu', 'Phương pháp'], ['Mã loại mẫu', 'Mã chỉ tiêu']]

export const positiveBigint = z.string().regex(/^[1-9][0-9]{0,18}$/).refine(value => value.length < 19 || value <= '9223372036854775807')
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
const cellText = z.string().max(32767)
const entity = z.object({
    id: uuid,
    importCode: z.string(),
    name: cellText.min(1),
    compatibilityGeneration: positiveBigint,
})
const snapshotSchema = z.object({
    revisionId: uuid,
    revisionNumber: positiveBigint,
    sampleTypes: z.array(entity.extend({ importCode: z.string().regex(/^LM-[0-9]{6}$/) }).strict()).min(1),
    assays: z.array(entity.extend({ importCode: z.string().regex(/^CT-[0-9]{6}$/), methodName: cellText.nullable() }).strict()).min(1),
    pairs: z.array(z.object({ sampleTypeId: uuid, assayDefinitionId: uuid }).strict()).min(1),
}).strict()
export type TemplateSnapshot = z.infer<typeof snapshotSchema>

export function validateTemplateSnapshot(input: unknown): TemplateSnapshot {
    const parsed = snapshotSchema.safeParse(input)
    if (!parsed.success) throw new Error('ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE')
    const snapshot = parsed.data
    for (const entities of [snapshot.sampleTypes, snapshot.assays]) {
        if (new Set(entities.map(entity => entity.id)).size !== entities.length || new Set(entities.map(entity => entity.importCode)).size !== entities.length) {
            throw new Error('ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE')
        }
    }
    const sampleIds = new Set(snapshot.sampleTypes.map(entity => entity.id))
    const assayIds = new Set(snapshot.assays.map(entity => entity.id))
    const usedSamples = new Set<string>()
    const usedAssays = new Set<string>()
    const pairs = new Set<string>()
    for (const pair of snapshot.pairs) {
        const key = JSON.stringify([pair.sampleTypeId, pair.assayDefinitionId])
        if (!sampleIds.has(pair.sampleTypeId) || !assayIds.has(pair.assayDefinitionId) || pairs.has(key)) throw new Error('ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE')
        pairs.add(key)
        usedSamples.add(pair.sampleTypeId)
        usedAssays.add(pair.assayDefinitionId)
    }
    if (usedSamples.size !== sampleIds.size || usedAssays.size !== assayIds.size) throw new Error('ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE')
    return snapshot
}

function sorted(rows: string[][]): string[][] {
    return [...rows].sort((a, b) => {
        const left = JSON.stringify(a)
        const right = JSON.stringify(b)
        if (left === right) return 0
        return left < right ? -1 : 1
    })
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

export function snapshotCatalogs(snapshot: TemplateSnapshot): string[][][] {
    const sampleCodes = new Map(snapshot.sampleTypes.map(entity => [entity.id, entity.importCode]))
    const assayCodes = new Map(snapshot.assays.map(entity => [entity.id, entity.importCode]))
    return [
        [[...CATALOG_HEADERS[0]], ...sorted(snapshot.sampleTypes.map(entity => [entity.importCode, entity.name]))],
        [[...CATALOG_HEADERS[1]], ...sorted(snapshot.assays.map(entity => [entity.importCode, entity.name, entity.methodName ?? '']))],
        [[...CATALOG_HEADERS[2]], ...sorted(snapshot.pairs.map(pair => [sampleCodes.get(pair.sampleTypeId)!, assayCodes.get(pair.assayDefinitionId)!]))],
    ]
}

export function authorityDigest(snapshot: TemplateSnapshot): string {
    const catalogs = snapshotCatalogs(snapshot)
    return digest(['accession-authority', 1, [snapshot.revisionId, snapshot.revisionNumber],
        sorted(snapshot.sampleTypes.map(entity => [entity.importCode, entity.id, entity.compatibilityGeneration])),
        sorted(snapshot.assays.map(entity => [entity.importCode, entity.id, entity.compatibilityGeneration])),
        catalogs[2].slice(1)])
}

export function catalogDigest(input: unknown): string {
    const parsed = z.array(z.array(z.array(cellText))).length(3).safeParse(input)
    if (!parsed.success) throw new Error('TEMPLATE_METADATA_INVALID')
    const catalogs = parsed.data
    for (let index = 0; index < catalogs.length; index++) {
        const rows = catalogs[index], headers = CATALOG_HEADERS[index]
        if (JSON.stringify(rows[0]) !== JSON.stringify(headers) || rows.length < 2 || rows.some(row => row.length !== headers.length)) throw new Error('TEMPLATE_METADATA_INVALID')
    }
    return digest(['accession-catalog', 1, catalogs.map(rows => [rows[0], ...sorted(rows.slice(1))])])
}

export function validGeneratedAt(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}
