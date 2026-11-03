// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { resourceFixture } from './test-fixtures'

vi.mock('server-only', () => ({}))

describe('bounded namespace-aware XML boundary', () => {
    it('accepts predefined/numeric references and namespace aliases as literal text', async () => {
        const { parseAccessionXml } = await import('./xml')
        const { WorkbookBudget } = await import('./budget')
        let text = ''
        await parseAccessionXml(Buffer.from('<a:r xmlns:a="urn:test"><a:t>&amp;&#48;&#x31;</a:t></a:r>'), new WorkbookBudget(resourceFixture()), { text: value => { text += value } })
        expect(text).toBe('&01')
    })

    it.each(['<a><b></a>', '<a x="1" x="2"/>', '<a>&unknown;</a>', '<!DOCTYPE a [<!ENTITY x "boom">]><a>&x;</a>', '<x:a/>'])('rejects malformed XML or DTD: %s', async source => {
        const { parseAccessionXml } = await import('./xml')
        const { WorkbookBudget } = await import('./budget')
        await expect(parseAccessionXml(Buffer.from(source), new WorkbookBudget(resourceFixture()), {})).rejects.toThrow('XML_INVALID')
    })

    it('bounds XML depth, token bytes and actual cells', async () => {
        const { parseAccessionXml } = await import('./xml')
        const { WorkbookBudget } = await import('./budget')
        for (const [source, change] of [
            ['<a><b><c/></b></a>', { maxXmlDepth: 2 }],
            ['<a>' + 'x'.repeat(200) + '</a>', { maxXmlTextBytes: 100 }],
            ['<r xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="A1"/><c r="A2"/></r>', { maxCells: 1 }],
        ] as const) await expect(parseAccessionXml(Buffer.from(source), new WorkbookBudget({ ...resourceFixture(), ...change }), {})).rejects.toThrow('RESOURCE_LIMIT')
    })

    it('checks geometry directly without iterating attacker-declared worksheet dimensions', async () => {
        const { parseAccessionXml } = await import('./xml')
        const { WorkbookBudget } = await import('./budget')
        for (const ref of ['A0', 'XFE1', 'A1048577', 'A01']) await expect(parseAccessionXml(Buffer.from(`<r xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="${ref}"/></r>`), new WorkbookBudget(resourceFixture()), {})).rejects.toThrow('XML_INVALID')
    })

    it('reserves SAX working state before an attribute token can accumulate', async () => {
        const { parseAccessionXml } = await import('./xml')
        const { WorkbookBudget } = await import('./budget')
        let opened = false
        await expect(parseAccessionXml(Buffer.from('<r attr="' + 'x'.repeat(10_000) + '"/>'), new WorkbookBudget({ ...resourceFixture(), maxRetainedBytes: 150_000 }), { open: () => { opened = true } })).rejects.toThrow('RESOURCE_LIMIT')
        expect(opened).toBe(false)
    })
})
