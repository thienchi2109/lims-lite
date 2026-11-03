// Namespace-aware streaming XML checks; no DTD/custom entities, DOM, formatting or formula engine.
import 'server-only'
import { SaxesParser, type SaxesTagNS } from 'saxes'
import { WorkbookBudget } from './budget'
import { WorkbookFailure } from './errors'

export const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
export type XmlEvents = { open?: (tag: SaxesTagNS) => void; close?: (tag: SaxesTagNS) => void; text?: (value: string) => void }
const invalid = (): never => { throw new Error('XML_INVALID') }

function cellGeometry(reference: string): void {
    const match = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(reference)
    if (!match) return invalid()
    let column = 0
    for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64
    if (column > 16384 || Number(match[2]) > 1048576) invalid()
}

export async function parseAccessionXml(bytes: Buffer, budget: WorkbookBudget, events: XmlEvents): Promise<void> {
    // SAX can accumulate a whole start tag before callbacks. Charge conservative token/attribute
    // objects and decoded strings before feeding bytes, not only the eventual retained cell text.
    const workingBytes = bytes.length * 64 + 131_072
    budget.reserve(workingBytes)
    const decoder = new TextDecoder('utf-8', { fatal: true })
    const parser = new SaxesParser({ xmlns: true, fragment: false })
    let depth = 0, textBytes = 0
    const token = (value: string) => {
        budget.check()
        if (Buffer.byteLength(value, 'utf8') > budget.limits.maxXmlTextBytes) throw new Error('RESOURCE_LIMIT')
    }
    parser.on('error', invalid)
    parser.on('doctype', invalid)
    parser.on('processinginstruction', invalid)
    parser.on('opentag', tag => {
        budget.check(); textBytes = 0
        if (++depth > budget.limits.maxXmlDepth) throw new Error('RESOURCE_LIMIT')
        token(tag.name)
        for (const attribute of Object.values(tag.attributes)) { token(attribute.name); token(attribute.value) }
        if (tag.uri === SPREADSHEET_NS && tag.local === 'c') {
            budget.cell()
            const reference = tag.attributes.r
            if (!reference || reference.uri !== '') invalid()
            cellGeometry(reference.value)
        }
        events.open?.(tag)
    })
    const text = (value: string) => {
        token(value); textBytes += Buffer.byteLength(value, 'utf8')
        if (textBytes > budget.limits.maxXmlTextBytes) throw new Error('RESOURCE_LIMIT')
        events.text?.(value)
    }
    parser.on('text', text); parser.on('cdata', text)
    parser.on('comment', token)
    parser.on('closetag', tag => { budget.check(); events.close?.(tag); depth--; textBytes = 0 })
    try {
        for (let offset = 0; offset < bytes.length; offset += 4096) {
            budget.check()
            parser.write(decoder.decode(bytes.subarray(offset, offset + 4096), { stream: true }))
            await budget.yield()
        }
        parser.write(decoder.decode()).close()
        if (depth !== 0) invalid()
    } catch (error) {
        if (error instanceof WorkbookFailure) throw error
        if (error instanceof Error && ['RESOURCE_LIMIT', 'XML_INVALID'].includes(error.message)) throw error
        invalid()
    } finally { budget.release(workingBytes) }
}
