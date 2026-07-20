import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'vitest'

async function readWorkspaceFile(relativePath: string) {
    return readFile(path.resolve(process.cwd(), relativePath), 'utf8')
}

test('CoA portal does not embed auth token in URLs', async () => {
    const content = await readWorkspaceFile('src/components/coa-access-form.tsx')

    assert.doesNotMatch(content, /[?&]token=/)
    assert.doesNotMatch(content, /\btoken\s*=\s*\$\{authResponse\.token\}/)
})

test('CoA download endpoint does not accept token via query string', async () => {
    const content = await readWorkspaceFile('src/app/api/coa/download/route.ts')

    assert.doesNotMatch(content, /searchParams\.get\(['"]token['"]\)/)
    assert.doesNotMatch(content, /\/api\/coa\/download\?sample_id=\{uuid\}&token=\{jwt\}/)
})

test('CoA authenticate endpoint stores token in an HttpOnly cookie', async () => {
    const content = await readWorkspaceFile('src/app/api/coa/authenticate/route.ts')

    assert.match(content, /cookies\.set\(/)
    assert.match(content, /['"]coa_token['"]/)
    assert.match(content, /\bhttpOnly\s*:\s*true\b/)
})
