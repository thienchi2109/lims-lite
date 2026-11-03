// Literal shared/rich strings only; no formatting text, cached formulas or formula evaluation.
import type { WorkbookBudget } from './budget'
import { semanticXml, unsupported } from './ooxml'

export const richGrammar: Record<string, string[]> = {
    si: ['t', 'r'], is: ['t', 'r'], r: ['rPr', 't'], t: [],
    rPr: ['rFont', 'charset', 'family', 'b', 'i', 'strike', 'outline', 'shadow', 'condense', 'extend', 'color', 'sz', 'u', 'vertAlign', 'scheme'],
    rFont: [], charset: [], family: [], b: [], i: [], strike: [], outline: [], shadow: [], condense: [], extend: [], color: [], sz: [], u: [], vertAlign: [], scheme: [],
}
export const decodeOoxmlText = (value: string): string => value.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
export const isSupportedLiteral = (value: string): boolean => !value.includes('\0') && value.isWellFormed()

export async function readSharedStrings(bytes: Buffer, budget: WorkbookBudget): Promise<string[]> {
    const values: string[] = []
    let value = '', inText = false, inString = false
    await semanticXml(bytes, budget, { '': ['sst'], sst: ['si'], ...richGrammar }, {
        open(tag) {
            if (tag.local === 'si') { inString = true; value = '' }
            if (tag.local === 't') inText = true
        },
        text(text) { if (inText) value += text; else if (text.trim()) unsupported() },
        close(tag) {
            if (tag.local === 't') inText = false
            if (tag.local === 'si') {
                if (!inString) unsupported()
                budget.reserve(value.length * 4 + 512)
                values.push(decodeOoxmlText(value)); inString = false
            }
        },
    })
    return values
}
