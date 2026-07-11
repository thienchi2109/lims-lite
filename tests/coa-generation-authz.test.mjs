import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readWorkspaceFile(relativePath) {
    return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function sliceFunctionBody(content, startMarker, endMarker) {
    const startIndex = content.indexOf(startMarker)
    assert.notEqual(startIndex, -1, `Missing marker: ${startMarker}`)

    const endIndex = endMarker ? content.indexOf(endMarker, startIndex) : -1
    if (endMarker && endIndex === -1) {
        throw new Error(`Missing marker: ${endMarker}`)
    }

    return content.slice(startIndex, endMarker ? endIndex : undefined)
}

test('generateCoA requires an authenticated analyst or manager', async () => {
    const content = await readWorkspaceFile('src/app/actions/coa.ts')

    const generateCoABody = sliceFunctionBody(
        content,
        'export async function generateCoA',
        'export async function regenerateCoA'
    )

    assert.match(generateCoABody, /supabase\.auth\.getUser\(\)/)
    assert.match(
        generateCoABody,
        /userRole\s*!==\s*['"]analyst['"]\s*&&\s*userRole\s*!==\s*['"]manager['"]/
    )
})
