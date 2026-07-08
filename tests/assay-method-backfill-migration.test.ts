import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(
    process.cwd(),
    'supabase/migrations/144_backfill_assay_definition_method_names.sql',
)

function readMigration() {
    return readFileSync(migrationPath, 'utf8')
}

function parseBackfillRows(sql: string) {
    const valuesBlock = sql.match(/VALUES\s*([\s\S]*?)\n\s*\),\s*updated_assays AS/)
    if (!valuesBlock) {
        return []
    }

    return [...valuesBlock[1].matchAll(/\(\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)'\s*\)/g)]
        .map(([, specialtyName, assayName, methodName, sourceNote]) => ({
            specialtyName: specialtyName.replace(/''/g, "'"),
            assayName: assayName.replace(/''/g, "'"),
            methodName: methodName.replace(/''/g, "'"),
            sourceNote: sourceNote.replace(/''/g, "'"),
        }))
}

describe('assay method-name backfill migration', () => {
    it('backfills method text from sourced rows and safe aliases only', () => {
        const migration = readMigration()
        const rows = parseBackfillRows(migration)

        expect(rows).toHaveLength(117)
        expect(rows).toContainEqual({
            specialtyName: 'Sinh hóa',
            assayName: 'Glucose',
            methodName: 'Máy sinh hóa tự động AU400',
            sourceNote: 'docs/assays_definition.md exact row',
        })
        expect(rows).toContainEqual({
            specialtyName: 'Sinh hóa',
            assayName: 'ALT (SGPT)',
            methodName: 'Máy sinh hóa tự động AU400',
            sourceNote: 'docs/assays_definition.md alias: SGPT',
        })
        expect(rows).toContainEqual({
            specialtyName: 'Huyết học',
            assayName: 'WBC Count',
            methodName: 'Máy huyết học Nihon Kohden',
            sourceNote: 'docs/assays_definition.md alias: WBC',
        })
        expect(rows).toContainEqual({
            specialtyName: 'Miễn dịch',
            assayName: 'Anti-H.Pylori',
            methodName: 'Test nhanh',
            sourceNote: 'docs/assays_definition.md exact row',
        })
        expect(rows).toContainEqual({
            specialtyName: 'Sinh học phân tử',
            assayName: 'HIV đo tải lượng hệ thống tự động',
            methodName: 'Hệ thống tự động Cobas 4800',
            sourceNote: 'docs/assays_definition.md exact row',
        })
        expect(rows).not.toContainEqual(expect.objectContaining({
            specialtyName: 'Huyết học',
            assayName: 'Tổng phân tích tế bào máu 18 thông số',
        }))
        expect(rows).not.toContainEqual(expect.objectContaining({
            specialtyName: 'Nước tiểu',
            assayName: 'Tổng phân tích nước tiểu',
        }))
    })

    it('updates only active assays whose method_name is still blank', () => {
        const migration = readMigration()

        expect(migration).toContain('assay.deleted_at IS NULL')
        expect(migration).toContain("(assay.method_name IS NULL OR btrim(assay.method_name) = '')")
        expect(migration).toContain('RAISE NOTICE')
    })
})
