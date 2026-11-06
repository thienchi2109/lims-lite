// Source recovery contract; PostgreSQL compilation and existing SQL fixtures remain runtime gates.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readMigration = (name: string) => readFileSync(`supabase/migrations/${name}`, 'utf8')
const path = 'supabase/migrations/238_recover_atomic_accession_confirmation.sql'
const recovery = existsSync(path) ? readFileSync(path, 'utf8') : ''
const historicalBody = (name: string) => {
    const sql = readMigration(name)
    return sql.slice(sql.indexOf('DO $baseline$'), sql.lastIndexOf('COMMIT;')).trim()
}

describe('atomic accession recovery migration', () => {
    it('keeps every historical migration byte-for-byte immutable', () => {
        const hashes = {
            '233_add_accession_preview_client_resolution.sql': 'fc895bc7c2ea1976b80f145263a3e8dd7d672fe443f29650905473c2741254dc',
            '234_add_accession_preview_commitment.sql': 'a4bb16cb004da4799c3084734a02f3eb3fbbb5904311c5ee0661ac5ff0a9ff53',
            '235_add_accession_import_provenance.sql': 'afd069b663bee98feed3d9ea33d9654a3fe52e3bc38c054cd4c354259f67ceaa',
            '236_add_accession_confirmation_validation.sql': 'c1e804b0f1293304c0650d7036a3c279d2c4f938cd80a22f270de571a2417803',
            '237_add_atomic_accession_confirmation.sql': '07ab7ea28b1c2cb292ce679f94ecd893161ec10748c20964c60e070a4d6a2835',
        }
        for (const [name, hash] of Object.entries(hashes)) {
            expect(createHash('sha256').update(readMigration(name)).digest('hex')).toBe(hash)
        }
    })

    it('recovers the original validation and atomic definitions with only the confirmed parser fix', () => {
        const condition = "CASE v_kind WHEN 'clients' THEN 'Khách hàng' WHEN 'samples' THEN 'Mẫu' ELSE 'Chỉ định' END"
        const validation = historicalBody('236_add_accession_confirmation_validation.sql')
            .replace(`IS DISTINCT FROM ${condition}`, `IS DISTINCT FROM (${condition})`)
        const atomic = historicalBody('237_add_atomic_accession_confirmation.sql')
        expect(recovery).toContain(validation)
        expect(recovery).toContain(atomic)
        expect(recovery.indexOf(validation)).toBeLessThan(recovery.indexOf(atomic))
    })

    it('requires the proven 235 baseline and checked function bodies in one transaction', () => {
        expect(recovery).toContain('Migration 238 supports only the verified 235 baseline')
        expect(recovery).toContain("current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE")
        expect(recovery).toContain('c59214d857dc91923ce41480901925267d20035cb1c988a3d9ddff2464ac3a8b')
        expect(recovery).toContain('b1050737434de758c3dd4d57382176807cfe7ee06d7b1f6448d8a3702333587d')
        expect(recovery.match(/^BEGIN;$/gm)).toHaveLength(1)
        expect(recovery.match(/^COMMIT;$/gm)).toHaveLength(1)
        expect(recovery).not.toMatch(/check_function_bodies\s*=\s*(off|false)|^\\i[mr]?\b|pg_read_file|ALTER ROLE/gim)
    })
})
